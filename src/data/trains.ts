import { ALL_STATIONS } from './stations';

export interface TrainType {
  h: string;
  n: string;
  st: 'r' | 'f';
}

export const TRAIN_TYPES: Record<string, TrainType> = {
  'tze-chiang': { h: '#5b8af5', n: '自強 3000', st: 'r' },
  'taroko':     { h: '#e06caa', n: '太魯閣號', st: 'r' },
  'puyuma':     { h: '#f59e5b', n: '普悠瑪號', st: 'r' },
  'chu-kuang':  { h: '#d4a95b', n: '莒光號',   st: 'f' },
  'local':      { h: '#4ec9b0', n: '區間車',   st: 'f' },
};

export const TYPE_ORDER = ['tze-chiang', 'taroko', 'puyuma', 'chu-kuang', 'local'];

export interface Stop {
  n: string;
  t: string;
}

export interface Train {
  id: string;
  type: string;
  no: number;
  dep: string;
  arr: string;
  dm: number;
  dur: string;
  price: number;
  dl: number;
  stops: Stop[];
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function buildStops(from: string, to: string, dep: string, dur: number): Stop[] {
  const fi = ALL_STATIONS.findIndex(s => s.n === from);
  const ti = ALL_STATIONS.findIndex(s => s.n === to);
  if (fi < 0 || ti < 0) return [];
  const dir = ti > fi ? 1 : -1;
  const list = [];
  for (let i = fi; i !== ti + dir; i += dir) list.push(ALL_STATIONS[i]);
  const step = dur / (list.length - 1 || 1);
  const [dH, dM] = dep.split(':').map(Number);
  return list.map((s, i) => {
    const m = Math.round(i * step);
    const h = dH + Math.floor((dM + m) / 60);
    return { n: s.n, t: `${pad(h % 24)}:${pad((dM + m) % 60)}` };
  });
}

const DEFS = [
  { type: 'tze-chiang', count: 5, durBase: 200, durVar: 60, price: 843 },
  { type: 'taroko',     count: 2, durBase: 190, durVar: 40, price: 843 },
  { type: 'puyuma',     count: 2, durBase: 195, durVar: 50, price: 843 },
  { type: 'chu-kuang',  count: 3, durBase: 270, durVar: 50, price: 653 },
  { type: 'local',      count: 6, durBase: 310, durVar: 90, price: 445 },
];

export function generateSchedule(from: string, to: string): Train[] {
  const all: Train[] = [];
  for (const d of DEFS) {
    for (let i = 0; i < d.count; i++) {
      const depH = 6 + Math.floor(Math.random() * 14);
      const depM = Math.floor(Math.random() * 60);
      const dur = d.durBase + Math.floor(Math.random() * d.durVar);
      const arrH = depH + Math.floor((depM + dur) / 60);
      const arrM = (depM + dur) % 60;
      const delay = Math.random() > 0.75 ? Math.floor(Math.random() * 12) + 1 : 0;
      const dep = `${pad(depH)}:${pad(depM)}`;
      all.push({
        id: `${d.type}-${i}`,
        type: d.type,
        no: Math.floor(Math.random() * 900) + 100,
        dep,
        arr: `${pad(arrH % 24)}:${pad(arrM)}`,
        dm: dur,
        dur: `${Math.floor(dur / 60)}h${pad(dur % 60)}m`,
        price: d.price,
        dl: delay,
        stops: buildStops(from, to, dep, dur),
      });
    }
  }
  return all.sort((a, b) => a.dep.localeCompare(b.dep));
}

export function groupByType(trains: Train[]): Record<string, Train[]> {
  const g: Record<string, Train[]> = {};
  for (const t of trains) {
    if (!g[t.type]) g[t.type] = [];
    g[t.type].push(t);
  }
  for (const arr of Object.values(g)) arr.sort((a, b) => a.dep.localeCompare(b.dep));
  return g;
}

export function nowTime(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function findNextIndex(trains: Train[]): number | null {
  const n = nowTime();
  const i = trains.findIndex(t => t.dep >= n);
  return i >= 0 ? i : null;
}
