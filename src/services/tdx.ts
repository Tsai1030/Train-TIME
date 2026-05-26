const BASE = '/tdx/api/basic';
const TOKEN_URL = '/tdx-auth/auth/realms/TDXConnect/protocol/openid-connect/token';
const TDX_CLIENT_ID = import.meta.env.VITE_TDX_CLIENT_ID || '';
const TDX_CLIENT_SECRET = import.meta.env.VITE_TDX_CLIENT_SECRET || '';

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

let accessToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  if (!TDX_CLIENT_ID || !TDX_CLIENT_SECRET) return null;
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: TDX_CLIENT_ID,
    client_secret: TDX_CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function get<T>(path: string): Promise<T> {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}$format=JSON`;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T;

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
    const res = await fetch(url, { headers });
    if (res.status === 429) { lastErr = new Error('API 請求過於頻繁，請稍後再試'); continue; }
    if (!res.ok) throw new Error(`TDX ${res.status}: ${res.statusText}`);
    const data = await res.json();
    cache.set(url, { data, ts: Date.now() });
    return data as T;
  }
  throw lastErr!;
}

// ─── Station Types ───
export interface TdxStation {
  StationID: string;
  StationName: { Zh_tw: string; En: string };
  StationClass: string;
  LocationCity: string;
  LocationCityCode: string;
}

export async function fetchStations(): Promise<TdxStation[]> {
  return get<TdxStation[]>('/v2/Rail/TRA/Station');
}

// ─── Timetable Types ───
interface StopTime {
  StopSequence: number;
  StationID: string;
  StationName: { Zh_tw: string; En: string };
  ArrivalTime: string;
  DepartureTime: string;
}

interface TrainInfo {
  TrainNo: string;
  TrainTypeCode: string;
  TrainTypeName: { Zh_tw: string; En: string };
  TripHeadSign: string;
  StartingStationID: string;
  StartingStationName: { Zh_tw: string; En: string };
  EndingStationID: string;
  EndingStationName: { Zh_tw: string; En: string };
  SuspendedFlag: number;
  Note: string;
}

interface TdxTimetableEntry {
  TrainInfo: TrainInfo;
  StopTimes: StopTime[];
}

interface TdxODResponse {
  TrainDate: string;
  TrainTimetables: TdxTimetableEntry[];
  UpdateTime: string;
}

export interface ParsedTrain {
  id: string;
  trainNo: string;
  typeCode: string;
  typeName: string;
  departure: string;
  arrival: string;
  durationMin: number;
  headSign: string;
  note: string;
}

const TYPE_CODE_MAP: Record<string, string> = {
  '1': 'taroko', '2': 'puyuma', '3': 'tze-chiang',
  '4': 'chu-kuang', '5': 'fu-hsing', '6': 'local',
  '7': 'local-express', '10': 'local-express', '11': 'emu3000',
};

const EMU3000_FREE_SEAT_TRAINS = new Set(['108','110','111','117','127','131','132','145','146','148','160']);

export function mapTypeCode(code: string, trainNo?: string): string {
  const base = TYPE_CODE_MAP[code] || 'local';
  if (base === 'emu3000' && trainNo && EMU3000_FREE_SEAT_TRAINS.has(trainNo)) {
    return 'emu3000-free';
  }
  return base;
}

export const TRAIN_TYPE_INFO: Record<string, { color: string; name: string; seat: 'r' | 'f'; order: number; tag?: string }> = {
  'local':           { color: '#4a90e2', name: '區間車',    seat: 'f', order: 0 },
  'local-express':   { color: '#2a5fb0', name: '區間快',    seat: 'f', order: 1 },
  'chu-kuang':       { color: '#e6c84c', name: '莒光號',    seat: 'f', order: 2, tag: '須購買車票' },
  'fu-hsing':        { color: '#e6c84c', name: '復興號',    seat: 'f', order: 3 },
  'tze-chiang':      { color: '#e8872e', name: '自強號',    seat: 'r', order: 4, tag: '須購買車票' },
  'emu3000':         { color: '#9b6dff', name: '新自強',    seat: 'r', order: 5, tag: '須購買車票' },
  'emu3000-free':    { color: '#c8b89a', name: 'EMU3000',   seat: 'f', order: 6, tag: '提供自由座' },
  'taroko':          { color: '#e84057', name: '太魯閣號',  seat: 'r', order: 7, tag: '須購買車票' },
  'puyuma':          { color: '#d63c3c', name: '普悠瑪號',  seat: 'r', order: 8, tag: '須購買車票' },
};

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function fetchODTimetable(
  originId: string, destId: string, date: string
): Promise<ParsedTrain[]> {
  const data = await get<TdxODResponse>(
    `/v3/Rail/TRA/DailyTrainTimetable/OD/${originId}/to/${destId}/${date}`
  );
  if (!data.TrainTimetables) return [];

  return data.TrainTimetables
    .filter(e => e.TrainInfo.SuspendedFlag !== 1)
    .map(e => {
      const dep = e.StopTimes[0]?.DepartureTime || '';
      const arr = e.StopTimes[e.StopTimes.length - 1]?.ArrivalTime || '';
      const dMin = parseTime(arr) - parseTime(dep);
      return {
        id: e.TrainInfo.TrainNo,
        trainNo: e.TrainInfo.TrainNo,
        typeCode: mapTypeCode(e.TrainInfo.TrainTypeCode, e.TrainInfo.TrainNo),
        typeName: TRAIN_TYPE_INFO[mapTypeCode(e.TrainInfo.TrainTypeCode, e.TrainInfo.TrainNo)]?.name ?? e.TrainInfo.TrainTypeName.Zh_tw,
        departure: dep,
        arrival: arr,
        durationMin: dMin < 0 ? dMin + 1440 : dMin,
        headSign: e.TrainInfo.TripHeadSign,
        note: e.TrainInfo.Note,
      };
    })
    .sort((a, b) => a.departure.localeCompare(b.departure));
}

// ─── Fare Types ───
interface TdxFareEntry {
  TicketType: string;
  Price: number;
}

interface TdxODFareResponse {
  Fares: TdxFareEntry[];
}

export interface FareInfo {
  express: number;
  chuKuang: number;
  local: number;
}

export async function fetchODFare(originId: string, destId: string): Promise<FareInfo> {
  const raw = await get<TdxODFareResponse | TdxODFareResponse[]>(
    `/v2/Rail/TRA/ODFare/${originId}/to/${destId}`
  );
  const data = Array.isArray(raw) ? raw[0] : raw;
  const fares = data?.Fares || [];
  const find = (key: string) => fares.find(f => f.TicketType === key)?.Price ?? 0;
  return {
    express: find('成自'),
    chuKuang: find('成莒'),
    local: find('成復'),
  };
}

// ─── Train Detail (all stops) ───
interface TdxTrainDetailResponse {
  TrainTimetables: Array<{
    TrainInfo: TrainInfo;
    StopTimes: StopTime[];
  }>;
}

export interface TrainStop {
  name: string;
  arrival: string;
  departure: string;
}

interface TdxGeneralTimetableEntry {
  GeneralTimetable: {
    GeneralTrainInfo: TrainInfo;
    StopTimes: StopTime[];
  };
}

export async function fetchTrainDetail(trainNo: string, _date: string): Promise<TrainStop[]> {
  const raw = await get<TdxGeneralTimetableEntry[]>(
    `/v2/Rail/TRA/GeneralTimetable/TrainNo/${trainNo}`
  );
  const entry = Array.isArray(raw) ? raw[0] : null;
  if (!entry?.GeneralTimetable?.StopTimes) return [];
  return entry.GeneralTimetable.StopTimes.map(s => ({
    name: s.StationName.Zh_tw,
    arrival: s.ArrivalTime,
    departure: s.DepartureTime,
  }));
}

// ─── Real-time delay (TrainLiveBoard) ───
interface TdxLiveBoardEntry {
  TrainNo: string;
  StationID: string;
  StationName: { Zh_tw: string; En: string };
  TrainTypeCode: string;
  DelayTime: number;
}

interface TdxLiveBoardResponse {
  TrainLiveBoards: TdxLiveBoardEntry[];
  UpdateTime: string;
}

export interface DelayMap {
  [trainNo: string]: number;
}

export async function fetchLiveBoard(): Promise<DelayMap> {
  try {
    const raw = await get<TdxLiveBoardResponse | TdxLiveBoardResponse[]>(
      '/v3/Rail/TRA/TrainLiveBoard'
    );
    const data = Array.isArray(raw) ? raw[0] : raw;
    const map: DelayMap = {};
    if (data?.TrainLiveBoards) {
      for (const entry of data.TrainLiveBoards) {
        map[entry.TrainNo] = entry.DelayTime;
      }
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Train Number Search ───
interface TdxGeneralTrainInfo {
  TrainNo: string;
  TrainTypeCode: string;
  TrainTypeName: { Zh_tw: string; En: string };
  StartingStationName: { Zh_tw: string; En: string };
  EndingStationName: { Zh_tw: string; En: string };
}

export interface TrainNoResult {
  trainNo: string;
  typeName: string;
  typeCode: string;
  color: string;
  from: string;
  to: string;
  stops: TrainStop[];
}

export async function fetchTrainByNo(trainNo: string): Promise<TrainNoResult | null> {
  const raw = await get<Array<{ GeneralTimetable: { GeneralTrainInfo: TdxGeneralTrainInfo; StopTimes: StopTime[] } }>>(
    `/v2/Rail/TRA/GeneralTimetable/TrainNo/${trainNo}`
  );
  const entry = Array.isArray(raw) ? raw[0] : null;
  if (!entry?.GeneralTimetable) return null;
  const info = entry.GeneralTimetable.GeneralTrainInfo;
  const tc = mapTypeCode(info.TrainTypeCode, info.TrainNo);
  const typeInfo = TRAIN_TYPE_INFO[tc];
  return {
    trainNo: info.TrainNo,
    typeName: typeInfo?.name ?? info.TrainTypeName.Zh_tw,
    typeCode: tc,
    color: typeInfo?.color ?? '#888',
    from: info.StartingStationName.Zh_tw,
    to: info.EndingStationName.Zh_tw,
    stops: entry.GeneralTimetable.StopTimes.map(s => ({
      name: s.StationName.Zh_tw,
      arrival: s.ArrivalTime,
      departure: s.DepartureTime,
    })),
  };
}

// ─── Station Timetable ───
interface TdxStationTTEntry {
  TrainNo: string;
  TrainTypeCode: string;
  TrainTypeName: { Zh_tw: string; En: string };
  DestinationStationName: { Zh_tw: string; En: string };
  ArrivalTime: string;
  DepartureTime: string;
}

interface TdxStationTTResponse {
  StationTimetables: Array<{
    Direction: number;
    TimeTables: TdxStationTTEntry[];
  }>;
}

export interface StationTTRow {
  trainNo: string;
  typeName: string;
  typeCode: string;
  color: string;
  destination: string;
  arrival: string;
  departure: string;
}

export async function fetchStationTimetable(stationId: string): Promise<StationTTRow[]> {
  const raw = await get<TdxStationTTResponse>(
    `/v3/Rail/TRA/DailyStationTimetable/Today/Station/${stationId}`
  );
  const all: StationTTRow[] = [];
  for (const dir of (raw?.StationTimetables ?? [])) {
    for (const t of dir.TimeTables) {
      const tc = mapTypeCode(t.TrainTypeCode, t.TrainNo);
      const typeInfo = TRAIN_TYPE_INFO[tc];
      all.push({
        trainNo: t.TrainNo,
        typeName: typeInfo?.name ?? t.TrainTypeName.Zh_tw,
        typeCode: tc,
        color: typeInfo?.color ?? '#888',
        destination: t.DestinationStationName.Zh_tw,
        arrival: t.ArrivalTime,
        departure: t.DepartureTime,
      });
    }
  }
  return all.sort((a, b) => a.departure.localeCompare(b.departure));
}
