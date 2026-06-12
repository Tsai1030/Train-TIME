import { useState, useCallback, useRef, useEffect } from 'react';
import { useStations, type Station } from './hooks/useStations';
import { fetchODTimetable, fetchODFare, fetchTrainDetail, fetchLiveBoard, fetchTrainByNo, fetchStationTimetable, TRAIN_TYPE_INFO, EMU3000_FREE_SEAT_TRAINS, type ParsedTrain, type FareInfo, type TrainStop, type DelayMap, type TrainNoResult, type StationTTRow } from './services/tdx';
import { useCommute } from './hooks/useCommute';
import { useNow, untilDeparture, fmtCountdown } from './hooks/useNow';
import { StationPicker } from './components/StationPicker/StationPicker';
import { TypeCard } from './components/TypeCard/TypeCard';
import { TrainRow } from './components/TrainRow/TrainRow';
import { RouteDetail } from './components/RouteDetail/RouteDetail';
import { Chips } from './components/Layout/Chips';
import { BottomNav, type Tab } from './components/BottomNav/BottomNav';
import { HeroCanvas } from './components/HeroCanvas/HeroCanvas';
import styles from './App.module.css';

type Screen = 'home' | 'results' | 'typeList' | 'detail' | 'trainNoResult' | 'stationResult';
type TimeMode = 'now' | 'depart' | 'arrive';
type AccentKey = 'cyan' | 'violet' | 'amber' | 'green';

/** 主題色（供 three.js 粒子與設定面板使用的近似 hex） */
const ACCENTS: Record<AccentKey, [string, string]> = {
  cyan: ['#56d9e8', '#9b7bf0'],
  violet: ['#b594f7', '#f077b8'],
  amber: ['#ecbb55', '#f3786a'],
  green: ['#4fe3a1', '#4ed0e0'],
};

interface Prefs { accent: AccentKey; fx: boolean; }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem('pulse-prefs') || '{}');
    return { accent: ACCENTS[p.accent as AccentKey] ? p.accent : 'cyan', fx: p.fx !== false };
  } catch { return { accent: 'cyan', fx: true }; }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function loadRecent(): Array<{ f: Station; t: Station }> {
  try { return JSON.parse(localStorage.getItem('pulse-recent') || '[]'); } catch { return []; }
}

function groupTrains(trains: ParsedTrain[]): Record<string, ParsedTrain[]> {
  const g: Record<string, ParsedTrain[]> = {};
  for (const t of trains) {
    if (!g[t.typeCode]) g[t.typeCode] = [];
    g[t.typeCode].push(t);
  }
  if (g['emu3000']) {
    const free = g['emu3000'].filter(t => EMU3000_FREE_SEAT_TRAINS.has(t.trainNo));
    if (free.length > 0) {
      g['emu3000-free'] = free;
    }
  }
  for (const arr of Object.values(g)) arr.sort((a, b) => a.departure.localeCompare(b.departure));
  return g;
}

function findNext(trains: ParsedTrain[]): number | null {
  const n = nowTime();
  const i = trains.findIndex(t => t.departure >= n);
  return i >= 0 ? i : null;
}

function Clock() {
  const now = useNow();
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className={styles.clock}>{p(now.getHours())}:{p(now.getMinutes())}:{p(now.getSeconds())}</span>;
}

/** 距下一班出發的即時倒數膠囊 */
function NextCountdown({ trains }: { trains: ParsedTrain[] }) {
  const now = useNow();
  const next = trains.find(t => untilDeparture(t.departure, now) !== null);
  if (!next) return null;
  const cd = untilDeparture(next.departure, now)!;
  return (
    <span className={styles.countChip}>
      <span className={styles.countChipDot} />
      下一班 {fmtCountdown(cd)}
    </span>
  );
}

export default function App() {
  const { regions, allStations, loading: stationsLoading } = useStations();
  const { commutes, addCommute, removeCommute } = useCommute();

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.accent = prefs.accent;
    localStorage.setItem('pulse-prefs', JSON.stringify(prefs));
  }, [prefs]);

  const [screen, setScreen] = useState<Screen>('home');
  const [tab, setTab] = useState<Tab>('s2s');
  const [fromSt, setFromSt] = useState<Station | null>(null);
  const [toSt, setToSt] = useState<Station | null>(null);
  const [modal, setModal] = useState<string | null>(null);

  const [timeMode, setTimeMode] = useState<TimeMode>('now');
  const [dateVal, setDateVal] = useState(todayISO());
  const [timeVal, setTimeVal] = useState('14:00');
  const [seat, setSeat] = useState('all');

  const [allTrains, setAllTrains] = useState<ParsedTrain[]>([]);
  const [grouped, setGrouped] = useState<Record<string, ParsedTrain[]>>({});
  const [fareInfo, setFareInfo] = useState<FareInfo | null>(null);
  const [selType, setSelType] = useState<string | null>(null);
  const [selTrain, setSelTrain] = useState<ParsedTrain | null>(null);
  const [selStops, setSelStops] = useState<TrainStop[]>([]);
  const [delayMap, setDelayMap] = useState<DelayMap>({});
  const [searching, setSearching] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [trainNumQ, setTrainNumQ] = useState('');
  const [stnQ, setStnQ] = useState<Station | null>(null);
  const [stnDir, setStnDir] = useState('dep');
  const [recent, setRecent] = useState(loadRecent);
  const [trainNoResult, setTrainNoResult] = useState<TrainNoResult | null>(null);
  const [stationTT, setStationTT] = useState<StationTTRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const trainHandle = useRef<import('./three/trainScene').TrainSceneHandle | null>(null);
  const [headerCompact, setHeaderCompact] = useState(false);

  const onHomeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    trainHandle.current?.setScroll(el.scrollTop / (el.clientHeight * 0.4));
  };

  const doSearch = useCallback(async (fArg?: Station, tArg?: Station) => {
    const f = fArg ?? fromSt;
    const t = tArg ?? toSt;
    if (!f || !t) return;
    setSearching(true);
    setSearchError(null);
    try {
      const date = timeMode === 'now' ? todayISO() : dateVal;
      const [trains, fares] = await Promise.all([
        fetchODTimetable(f.id, t.id, date),
        fetchODFare(f.id, t.id),
      ]);
      let filtered = trains;
      if (seat === 'reserved') filtered = filtered.filter(x => TRAIN_TYPE_INFO[x.typeCode]?.seat === 'r');
      if (seat === 'free') filtered = filtered.filter(x => TRAIN_TYPE_INFO[x.typeCode]?.seat === 'f');
      if (timeMode === 'arrive') filtered = filtered.filter(x => x.arrival <= timeVal);
      setAllTrains(filtered);
      setGrouped(groupTrains(filtered));
      setFareInfo(fares);
      setHeaderCompact(false);
      setScreen('results');
      const nr = [{ f, t }, ...recent.filter(r => !(r.f.id === f.id && r.t.id === t.id))].slice(0, 4);
      setRecent(nr);
      localStorage.setItem('pulse-recent', JSON.stringify(nr));
      fetchLiveBoard().then(setDelayMap).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : '查詢失敗';
      setSearchError(msg);
      console.error('Search failed:', e);
    } finally {
      setSearching(false);
    }
  }, [fromSt, toSt, seat, timeMode, timeVal, dateVal, recent]);

  const openDetail = async (train: ParsedTrain) => {
    setSelTrain(train);
    setSelStops([]);
    setScreen('detail');
    const date = timeMode === 'now' ? todayISO() : dateVal;
    try {
      const stops = await fetchTrainDetail(train.trainNo, date);
      setSelStops(stops);
    } catch { setSelStops([]); }
  };

  const doSwap = () => {
    setSwapping(true);
    setTimeout(() => { const tmp = fromSt; setFromSt(toSt); setToSt(tmp); setSwapping(false); }, 200);
  };

  const flipAndSearch = () => {
    const f = toSt, t = fromSt;
    setFromSt(f); setToSt(t);
    if (f && t) doSearch(f, t);
  };

  const handleModalPick = (s: Station) => {
    if (modal === 'from') setFromSt(s);
    else if (modal === 'to') setToSt(s);
    else setStnQ(s);
  };

  const goTab = (t: Tab) => { setTab(t); setScreen('home'); };

  const stationRow = (st: Station | null, label: string, which: string) => (
    <div className={styles.stationRow} onClick={() => setModal(which)}>
      <div className={styles.stationLabel}>{label}</div>
      {st ? (
        <>
          <span className={styles.stationName}>{st.name}</span>
          <span className={styles.stationRegion}>{st.city}</span>
        </>
      ) : (
        <span className={styles.stationPlaceholder}>選擇車站</span>
      )}
      <span className={styles.stationArrow}>&rsaquo;</span>
    </div>
  );

  const PANEL_TITLES: Record<Tab, string> = {
    s2s: 'ROUTE — 站到站查詢',
    train: 'TRAIN NO — 車次查詢',
    stn: 'STATION — 車站看板',
    commute: 'COMMUTE — 我的通勤',
  };

  // ═══ HOME ═══
  const renderHome = () => (
    <div className={styles.page}>
      {prefs.fx
        ? <HeroCanvas onReady={h => { trainHandle.current = h; }} accent={ACCENTS[prefs.accent][0]} accent2={ACCENTS[prefs.accent][1]} />
        : <div className={styles.heroFallback} />}

      <div className={styles.homeScroll} onScroll={onHomeScroll}>
        <div className={styles.hero}>
          <div className={styles.topBar}>
            <span className={styles.liveChip}><span className={styles.liveDot} />LIVE</span>
            <Clock />
            <button className={styles.gearBtn} onClick={() => setSettingsOpen(true)} aria-label="外觀設定">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
          <div className={styles.brandBlock}>
            <h1 className={styles.brandName}>鐵道脈</h1>
            <div className={styles.brandSub}>Pulse · Midnight Rail</div>
            <p className={styles.tagline}>台鐵時刻 × 即時脈動 — 往下捲，列車化作光</p>
          </div>
          <div className={styles.scrollHint}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m5 9 7 7 7-7" /></svg>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>{PANEL_TITLES[tab]}</div>

          {tab === 's2s' && (
            <>
              <div className={styles.stationCard}>
                {stationRow(fromSt, '出發', 'from')}
                <div className={styles.swapWrap}>
                  <button className={styles.swapBtn} onClick={doSwap} aria-label="交換起訖站" style={{ transform: swapping ? 'rotate(180deg) scale(1.1)' : 'rotate(0)' }}>&#8693;</button>
                </div>
                {stationRow(toSt, '到達', 'to')}
              </div>

              <div className={styles.timeRow}>
                {([['now', '現在出發'], ['depart', '指定時間'], ['arrive', '最晚抵達']] as const).map(([v, l]) => (
                  <button key={v} className={`${styles.timeChip} ${timeMode === v ? styles.timeActive : ''}`} onClick={() => setTimeMode(v)}>{l}</button>
                ))}
              </div>

              {timeMode !== 'now' && (
                <div className={styles.dateTimeRow}>
                  <input type="date" className={styles.dtInput} value={dateVal} onChange={e => setDateVal(e.target.value)} />
                  <input type="time" className={styles.dtInputSmall} value={timeVal} onChange={e => setTimeVal(e.target.value)} />
                </div>
              )}

              <div className={styles.filterArea}>
                <div className={styles.filterLabel}>座位</div>
                <Chips options={[{ v: 'all', l: '全部' }, { v: 'reserved', l: '對號座' }, { v: 'free', l: '自由座' }]} value={seat} onChange={setSeat} />
              </div>

              <button className={`${styles.searchBtn} ${fromSt && toSt ? styles.searchActive : ''}`} onClick={() => doSearch()} disabled={!fromSt || !toSt || searching}>
                {searching ? '查詢中...' : timeMode === 'arrive' ? '查詢（最晚抵達）' : '查詢班次'}
              </button>
              {fromSt && toSt && !commutes.some(c => c.from.id === fromSt.id && c.to.id === toSt.id) && (
                <button className={styles.setCommuteBtn} onClick={() => addCommute({ from: fromSt, to: toSt })}>
                  ＋ 設為通勤路線
                </button>
              )}
              {searchError && <div className={styles.errorMsg}>{searchError}</div>}

              {recent.length > 0 && (
                <div className={styles.recentSection}>
                  <div className={styles.recentLabel}>RECENT — 最近查詢</div>
                  <div className={styles.recentRow}>
                    {recent.map((r, i) => (
                      <div key={i} className={styles.recentChip} onClick={() => { setFromSt(r.f); setToSt(r.t); }}>
                        <span className={styles.recentBold}>{r.f.name}</span>
                        <span className={styles.recentArrowTx}>&rarr;</span>
                        <span className={styles.recentBold}>{r.t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'train' && (
            <>
              <p className={styles.tabDesc}>輸入車次號碼，查詢完整路線與停靠時刻</p>
              <input className={styles.trainNumInput} value={trainNumQ} onChange={e => setTrainNumQ(e.target.value)} placeholder="1107" inputMode="numeric" />
              <button className={`${styles.searchBtn} ${trainNumQ ? styles.searchActive : ''}`} disabled={!trainNumQ || searching}
                onClick={async () => {
                  if (!trainNumQ) return;
                  setSearching(true); setSearchError(null);
                  try {
                    const result = await fetchTrainByNo(trainNumQ.trim());
                    if (result) { setTrainNoResult(result); setScreen('trainNoResult'); }
                    else { setSearchError('找不到此車次'); }
                  } catch (e) { setSearchError(e instanceof Error ? e.message : '查詢失敗'); }
                  finally { setSearching(false); }
                }}>
                {searching ? '查詢中...' : '查詢車次'}
              </button>
              {searchError && <div className={styles.errorMsg}>{searchError}</div>}
            </>
          )}

          {tab === 'stn' && (
            <>
              <p className={styles.tabDesc}>查看車站今日所有出發或到達列車</p>
              <div className={styles.stationCard} onClick={() => setModal('stn')} style={{ cursor: 'pointer' }}>
                <div className={styles.stationRow}>
                  <div className={styles.stationLabel}>車站</div>
                  {stnQ ? <span className={styles.stationName}>{stnQ.name}</span> : <span className={styles.stationPlaceholder}>選擇車站</span>}
                  <span className={styles.stationArrow}>&rsaquo;</span>
                </div>
              </div>
              <div className={styles.filterArea}>
                <div className={styles.filterLabel}>方向</div>
                <Chips options={[{ v: 'dep', l: '出發列車' }, { v: 'arr', l: '到達列車' }]} value={stnDir} onChange={setStnDir} />
              </div>
              <button className={`${styles.searchBtn} ${stnQ ? styles.searchActive : ''}`} disabled={!stnQ || searching}
                onClick={async () => {
                  if (!stnQ) return;
                  setSearching(true); setSearchError(null);
                  try {
                    const rows = await fetchStationTimetable(stnQ.id);
                    setStationTT(rows);
                    setScreen('stationResult');
                  } catch (e) { setSearchError(e instanceof Error ? e.message : '查詢失敗'); }
                  finally { setSearching(false); }
                }}>
                {searching ? '查詢中...' : '查詢車站'}
              </button>
              {searchError && <div className={styles.errorMsg}>{searchError}</div>}
            </>
          )}

          {tab === 'commute' && (
            commutes.length > 0 ? (
              <div className={styles.commuteList}>
                {commutes.map((c, i) => (
                  <div key={`${c.from.id}-${c.to.id}`} className={styles.commuteCard} style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className={styles.commuteTop}>
                      <span className={styles.commuteRoute}>{c.from.name} <span className={styles.recentArrowTx}>&rarr;</span> {c.to.name}</span>
                      <button className={styles.commuteRemove} onClick={() => removeCommute(i)} aria-label="移除">&times;</button>
                    </div>
                    <button className={styles.commuteBtn} onClick={() => { setFromSt(c.from); setToSt(c.to); setTimeMode('now'); doSearch(c.from, c.to); }}>立即查詢</button>
                  </div>
                ))}
                <button className={styles.setCommuteBtn} onClick={() => goTab('s2s')}>＋ 新增通勤路線</button>
              </div>
            ) : (
              <div className={styles.commuteEmpty}>
                <div className={styles.commuteEmptyTitle}>尚未設定通勤路線</div>
                <div className={styles.commuteEmptyDesc}>在「站到站」選好出發站和到達站後，<br />點擊「設為通勤路線」即可一鍵直達</div>
                <button className={styles.commuteGoSet} onClick={() => goTab('s2s')}>前往設定</button>
              </div>
            )
          )}
        </div>

        <div className={styles.dockSpace} />
      </div>

      {stationsLoading && (
        <div className={styles.loader}>
          <div className={styles.loaderRail} />
          <span className={styles.loaderText}>載入車站資料中</span>
        </div>
      )}
    </div>
  );

  // ═══ RESULTS ═══
  const onResultsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const c = e.currentTarget.scrollTop > 28;
    if (c !== headerCompact) setHeaderCompact(c);
  };

  const renderResults = () => {
    const typeOrder = Object.keys(grouped).sort((a, b) => {
      const oa = TRAIN_TYPE_INFO[a]?.order ?? 99;
      const ob = TRAIN_TYPE_INFO[b]?.order ?? 99;
      return oa - ob;
    });

    const getFare = (typeCode: string): number => {
      if (!fareInfo) return 0;
      const info = TRAIN_TYPE_INFO[typeCode];
      if (!info) return 0;
      if (info.seat === 'r') return fareInfo.express;
      return fareInfo.local;
    };

    return (
      <div className={styles.page}>
        <div className={`${styles.pageHeader} ${headerCompact ? styles.pageHeaderCompact : ''}`}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')} aria-label="返回">&larr;</button>
            <span className={styles.headerSub}>選擇車種</span>
            <button className={styles.flipBtn} onClick={flipAndSearch}>查回程 &#8644;</button>
          </div>
          <div className={styles.routeTitle}>
            <span className={styles.bigStation}>{fromSt?.name}</span>
            <span className={styles.routeArrowTx}>&rarr;</span>
            <span className={styles.bigStation}>{toSt?.name}</span>
          </div>
          <div className={styles.metaLine}>
            <span>{timeMode === 'now' ? todayISO() : dateVal}</span>
            <span>{allTrains.length} 班</span>
            {timeMode === 'arrive' && <span style={{ color: 'var(--ac)' }}>抵達 {timeVal} 前</span>}
            {timeMode === 'now' && <NextCountdown trains={allTrains} />}
          </div>
        </div>
        <div className={styles.cardList} onScroll={onResultsScroll}>
          {typeOrder.map((k, i) => (
            <TypeCard key={k} typeKey={k} trains={grouped[k]} farePrice={getFare(k)}
              index={i} nextIdx={findNext(grouped[k])}
              onClick={() => { setSelType(k); setScreen('typeList'); }} />
          ))}
          {typeOrder.length === 0 && <div className={styles.empty}>{searching ? '查詢中...' : '沒有符合條件的班次'}</div>}
        </div>
      </div>
    );
  };

  // ═══ TYPE LIST ═══
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screen === 'typeList') {
      const tick = () => {
        if (!scrollRef.current) return;
        const trains = grouped[selType!] || [];
        const nextI = findNext(trains);
        if (nextI !== null && nextI > 0) {
          const rows = scrollRef.current.querySelectorAll('[data-train-row]');
          if (rows[nextI]) {
            const containerRect = scrollRef.current.getBoundingClientRect();
            const rowRect = (rows[nextI] as HTMLElement).getBoundingClientRect();
            scrollRef.current.scrollTop += rowRect.top - containerRect.top - 60;
          }
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(tick));
    }
  }, [screen, selType, grouped]);

  const renderTypeList = () => {
    const trains = grouped[selType!] || [];
    const tc = TRAIN_TYPE_INFO[selType!] || { color: '#888', name: selType, seat: 'f' };
    const nextI = findNext(trains);
    const price = fareInfo ? (tc.seat === 'r' ? fareInfo.express : fareInfo.local) : 0;
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader} style={{ borderBottom: '1px solid var(--bd)' }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('results')} aria-label="返回">&larr;</button>
            <span className={styles.headerSub}>{fromSt?.name} &rarr; {toSt?.name}</span>
          </div>
          <div className={styles.typeTitle}>
            <span style={{ color: tc.color, textShadow: `0 0 20px ${tc.color}66` }}>{tc.name}</span>
            {price > 0 && <span className={styles.typePrice}>${price}</span>}
          </div>
          <div className={styles.typeMeta}>{trains.length} 班次{nextI !== null ? '' : ' · 今日班次皆已發車'}</div>
        </div>
        <div className={styles.trainScroll} ref={scrollRef}>
          {trains.map((tr, i) => (
            <div key={tr.id}>
              {i === nextI && <div className={styles.nowDivider}>NOW {nowTime()}</div>}
              <TrainRow train={tr} isNext={i === nextI} index={i} price={price} delayMin={delayMap[tr.trainNo] ?? -1} onClick={() => openDetail(tr)} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══ TRAIN NO RESULT ═══
  const renderTrainNoResult = () => {
    if (!trainNoResult) return null;
    const r = trainNoResult;
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader} style={{ borderBottom: '1px solid var(--bd)' }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')} aria-label="返回">&larr;</button>
            <span className={styles.headerSub}>車次查詢</span>
          </div>
          <div className={styles.typeTitle}>
            <span style={{ color: r.color, textShadow: `0 0 20px ${r.color}66` }}>{r.typeName}</span>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>#{r.trainNo}</span>
          </div>
          <div className={styles.typeMeta}>{r.from} &rarr; {r.to} · {r.stops.length} 站</div>
        </div>
        <div className={styles.trainScroll}>
          {r.stops.map((s, i) => {
            const isEnd = i === 0 || i === r.stops.length - 1;
            return (
              <div key={i} className={styles.stopLine} style={{ animationDelay: `${Math.min(i, 18) * 0.025}s` }}>
                <div className={styles.stopDot} style={{
                  background: isEnd ? r.color : 'transparent',
                  border: isEnd ? 'none' : `2px solid ${r.color}55`,
                  boxShadow: isEnd ? `0 0 10px ${r.color}88` : 'none',
                }} />
                <span className={isEnd ? styles.stopNameEnd : styles.stopName}>{s.name}</span>
                <span className={isEnd ? styles.stopTimeEnd : styles.stopTime} style={isEnd ? { color: r.color } : {}}>{s.arrival}</span>
                <span className={isEnd ? styles.stopTimeEnd : styles.stopTime} style={isEnd ? { color: r.color } : {}}>{s.departure}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══ STATION RESULT ═══
  const renderStationResult = () => {
    const nowStr = nowTime();
    const nextI = stationTT.findIndex(t => t.departure >= nowStr);
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader} style={{ borderBottom: '1px solid var(--bd)' }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')} aria-label="返回">&larr;</button>
            <span className={styles.headerSub}>車站看板</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--tx)' }}>{stnQ?.name}</div>
          <div className={styles.typeMeta}>{stationTT.length} 班次 · {stnDir === 'dep' ? '出發' : '到達'}列車</div>
        </div>
        <div className={styles.trainScroll} ref={scrollRef}>
          {stationTT.map((t, i) => (
            <div key={`${t.trainNo}-${i}`} data-train-row className={styles.ttRow} style={{ animationDelay: `${Math.min(i, 16) * 0.02}s` }}>
              {i === nextI && <div className={styles.ttNextBar} />}
              <div className={styles.ttNoCol}>
                <div className={styles.ttNo} style={{ color: t.color }}>#{t.trainNo}</div>
                {i === nextI && <span className={styles.ttNextTag}>下一班</span>}
              </div>
              <div className={styles.ttMain}>
                <div className={styles.ttTime}>{t.departure}</div>
                <div className={styles.ttSub}>{t.typeName} &rarr; {t.destination}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══ 設定抽屜 ═══
  const renderSettings = () => (
    <div className={styles.setRoot}>
      <div className={styles.setBackdrop} onClick={() => setSettingsOpen(false)} />
      <div className={styles.setSheet}>
        <div className={styles.setHandle} />
        <div className={styles.setTitle}>外觀</div>
        <div className={styles.setRow}>
          <div>
            <div className={styles.setLabel}>主題色</div>
            <div className={styles.setHint}>霓虹光暈與粒子列車的色調</div>
          </div>
          <div className={styles.accentDots}>
            {(Object.keys(ACCENTS) as AccentKey[]).map(k => (
              <button
                key={k}
                className={`${styles.accentDot} ${prefs.accent === k ? styles.accentActive : ''}`}
                style={{ background: ACCENTS[k][0], color: ACCENTS[k][0] }}
                onClick={() => setPrefs(p => ({ ...p, accent: k }))}
                aria-label={`主題色 ${k}`}
              />
            ))}
          </div>
        </div>
        <div className={styles.setRow}>
          <div>
            <div className={styles.setLabel}>粒子列車特效</div>
            <div className={styles.setHint}>關閉可省電、提升舊機型流暢度</div>
          </div>
          <button
            className={`${styles.fxToggle} ${prefs.fx ? styles.fxToggleOn : ''}`}
            onClick={() => setPrefs(p => ({ ...p, fx: !p.fx }))}
            aria-label="切換特效"
          >
            <span className={styles.fxKnob} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.viewport}>
      {screen === 'home' && renderHome()}
      {screen === 'results' && renderResults()}
      {screen === 'typeList' && renderTypeList()}
      {screen === 'trainNoResult' && renderTrainNoResult()}
      {screen === 'stationResult' && renderStationResult()}
      {screen === 'detail' && selTrain && (
        <RouteDetail train={selTrain} stops={selStops} from={fromSt?.name ?? ''} to={toSt?.name ?? ''}
          farePrice={fareInfo ? (TRAIN_TYPE_INFO[selTrain.typeCode]?.seat === 'r' ? fareInfo.express : fareInfo.local) : 0}
          delayMin={delayMap[selTrain.trainNo] ?? -1}
          onBack={() => setScreen('typeList')} />
      )}

      {screen === 'home' && <BottomNav tab={tab} onChange={goTab} />}
      <StationPicker
        open={modal !== null}
        label={modal === 'from' ? '出發站' : modal === 'to' ? '到達站' : '查詢車站'}
        regions={regions}
        allStations={allStations}
        onPick={handleModalPick}
        onClose={() => setModal(null)}
      />
      {settingsOpen && renderSettings()}
    </div>
  );
}
