import { useState, useCallback, useRef, useEffect } from 'react';
import { useStations, type Station } from './hooks/useStations';
import { fetchODTimetable, fetchODFare, fetchTrainDetail, fetchLiveBoard, fetchTrainByNo, fetchStationTimetable, TRAIN_TYPE_INFO, EMU3000_FREE_SEAT_TRAINS, type ParsedTrain, type FareInfo, type TrainStop, type DelayMap, type TrainNoResult, type StationTTRow } from './services/tdx';
import { useTheme } from './hooks/useTheme';
import { StationPicker } from './components/StationPicker/StationPicker';
import { TypeCard } from './components/TypeCard/TypeCard';
import { TrainRow } from './components/TrainRow/TrainRow';
import { RouteDetail } from './components/RouteDetail/RouteDetail';
import { Chips } from './components/Layout/Chips';
import styles from './App.module.css';

type Screen = 'home' | 'results' | 'typeList' | 'detail' | 'trainNoResult' | 'stationResult';
type Tab = 's2s' | 'train' | 'stn';
type TimeMode = 'now' | 'depart' | 'arrive';

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

export default function App() {
  const { config, setConfig } = useTheme();
  const { regions, allStations, loading: stationsLoading } = useStations();
  const [tweaksOpen, setTweaksOpen] = useState(false);

  const [screen, setScreen] = useState<Screen>('home');
  const [tab, setTab] = useState<Tab>('s2s');
  const [fromSt, setFromSt] = useState<Station | null>(null);
  const [toSt, setToSt] = useState<Station | null>(null);
  const [modal, setModal] = useState<string | null>(null);

  const [timeMode, setTimeMode] = useState<TimeMode>('now');
  const [dateVal, setDateVal] = useState(todayISO());
  const [timeVal, setTimeVal] = useState('14:00');
  const [seat, setSeat] = useState('all');
  const [route, setRoute] = useState('direct');
  const [moreOpen, setMoreOpen] = useState(false);

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

  void route;

  const [searchError, setSearchError] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    if (!fromSt || !toSt) return;
    setSearching(true);
    setSearchError(null);
    try {
      const date = timeMode === 'now' ? todayISO() : dateVal;
      const [trains, fares] = await Promise.all([
        fetchODTimetable(fromSt.id, toSt.id, date),
        fetchODFare(fromSt.id, toSt.id),
      ]);
      let filtered = trains;
      if (seat === 'reserved') filtered = filtered.filter(x => TRAIN_TYPE_INFO[x.typeCode]?.seat === 'r');
      if (seat === 'free') filtered = filtered.filter(x => TRAIN_TYPE_INFO[x.typeCode]?.seat === 'f');
      if (timeMode === 'arrive') filtered = filtered.filter(x => x.arrival <= timeVal);
      setAllTrains(filtered);
      setGrouped(groupTrains(filtered));
      setFareInfo(fares);
      setScreen('results');
      const nr = [{ f: fromSt, t: toSt }, ...recent.filter(r => !(r.f.id === fromSt.id && r.t.id === toSt.id))].slice(0, 4);
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
    setScreen('detail');
    const date = timeMode === 'now' ? todayISO() : dateVal;
    try {
      const stops = await fetchTrainDetail(train.trainNo, date);
      setSelStops(stops);
    } catch { setSelStops([]); }
  };

  const doSwap = () => {
    setSwapping(true);
    setTimeout(() => { const tmp = fromSt; setFromSt(toSt); setToSt(tmp); setSwapping(false); }, 180);
  };

  const handleModalPick = (s: Station) => {
    if (modal === 'from') setFromSt(s);
    else if (modal === 'to') setToSt(s);
    else setStnQ(s);
  };

  const tabBar = (
    <div className={styles.tabBar}>
      {([['s2s', '站到站'], ['train', '車次'], ['stn', '車站']] as const).map(([k, l]) => (
        <button key={k} className={`${styles.tab} ${tab === k ? styles.tabActive : ''}`} onClick={() => setTab(k)}>{l}</button>
      ))}
    </div>
  );

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

  // ═══ HOME ═══
  const renderHome = () => (
    <div className={styles.page}>
      <div className={styles.brand}>
        <span className={styles.brandName}>鐵道脈</span>
        <span className={styles.brandSub}>PULSE</span>
      </div>
      {tabBar}
      <div className={styles.scrollArea}>
        {tab === 's2s' && (
          <div className={styles.formArea}>
            <div className={styles.stationCard}>
              {stationRow(fromSt, '出發', 'from')}
              <div className={styles.swapWrap}>
                <button className={styles.swapBtn} onClick={doSwap} style={{ transform: swapping ? 'rotate(180deg)' : 'rotate(0)' }}>&#8693;</button>
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
              <div>
                <div className={styles.filterLabel}>座位</div>
                <Chips options={[{ v: 'all', l: '全部' }, { v: 'reserved', l: '對號座' }, { v: 'free', l: '自由座' }]} value={seat} onChange={setSeat} />
              </div>
              <div>
                <div className={styles.filterLabel}>路線</div>
                <Chips options={[{ v: 'direct', l: '直達' }, { v: 'transfer', l: '含轉乘' }]} value={route} onChange={setRoute} />
              </div>
            </div>

            <button className={`${styles.searchBtn} ${fromSt && toSt ? styles.searchActive : ''}`} onClick={doSearch} disabled={!fromSt || !toSt || searching}>
              {searching ? '查詢中...' : timeMode === 'arrive' ? '查詢（最晚抵達）' : '查詢班次'}
            </button>
            {searchError && <div className={styles.errorMsg}>{searchError}</div>}

            {recent.length > 0 && (
              <div className={styles.recentSection}>
                <div className={styles.recentLabel}>最近查詢</div>
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
          </div>
        )}

        {tab === 'train' && (
          <div className={styles.formArea}>
            <p className={styles.tabDesc}>輸入車次號碼查詢路線與即時狀態</p>
            <input className={styles.trainNumInput} value={trainNumQ} onChange={e => setTrainNumQ(e.target.value)} placeholder="例：1107" />
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
          </div>
        )}

        {tab === 'stn' && (
          <div className={styles.formArea}>
            <p className={styles.tabDesc}>查看車站所有出發或到達列車</p>
            <div className={styles.stationCard} onClick={() => setModal('stn')} style={{ cursor: 'pointer' }}>
              <div className={styles.stationRow}>
                <div className={styles.stationLabel}>查詢車站</div>
                {stnQ ? <span className={styles.stationName}>{stnQ.name}</span> : <span className={styles.stationPlaceholder}>選擇車站</span>}
                <span className={styles.stationArrow}>&rsaquo;</span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
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
          </div>
        )}
      </div>
      {stationsLoading && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',zIndex:60}}>
        <span style={{color:'var(--s2)',fontSize:14}}>載入車站資料中...</span>
      </div>}
      <StationPicker
        open={modal !== null}
        label={modal === 'from' ? '出發站' : modal === 'to' ? '到達站' : '查詢車站'}
        regions={regions}
        allStations={allStations}
        onPick={handleModalPick}
        onClose={() => setModal(null)}
      />
    </div>
  );

  // ═══ RESULTS ═══
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
        <div className={styles.pageHeader}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')}>&larr;</button>
            <span className={styles.headerSub}>選擇車種</span>
            <button className={styles.flipBtn} onClick={() => { const tmp = fromSt; setFromSt(toSt); setToSt(tmp); }}>查回程</button>
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
          </div>
        </div>
        <div className={styles.cardList}>
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
            const container = scrollRef.current;
            const row = rows[nextI] as HTMLElement;
            container.scrollTop = row.offsetTop - 20;
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
        <div className={styles.pageHeader} style={{ borderBottom: `1px solid var(--bd)` }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('results')}>&larr;</button>
            <span className={styles.headerSub}>{fromSt?.name} &rarr; {toSt?.name}</span>
          </div>
          <div className={styles.typeTitle}>
            <span style={{ color: tc.color }}>{tc.name}</span>
            {price > 0 && <span className={styles.typePrice}>${price}</span>}
          </div>
          <div className={styles.typeMeta}>{trains.length} 班次</div>
        </div>
        <div className={styles.trainScroll} ref={scrollRef}>
          {trains.map((tr, i) => (
            <TrainRow key={tr.id} train={tr} isNext={i === nextI} index={i} price={price} delayMin={delayMap[tr.trainNo] ?? -1} onClick={() => openDetail(tr)} />
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
        <div className={styles.pageHeader} style={{ borderBottom: `1px solid var(--bd)` }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')}>&larr;</button>
            <span className={styles.headerSub}>車次查詢</span>
          </div>
          <div className={styles.typeTitle}>
            <span style={{ color: r.color }}>{r.typeName}</span>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>#{r.trainNo}</span>
          </div>
          <div className={styles.typeMeta}>{r.from} → {r.to} · {r.stops.length} 站</div>
        </div>
        <div className={styles.trainScroll}>
          {r.stops.map((s, i) => {
            const isEnd = i === 0 || i === r.stops.length - 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: isEnd ? '14px 0' : '10px 0', borderBottom: '1px solid color-mix(in srgb, var(--bd) 15%, transparent)', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isEnd ? r.color : 'var(--sa)', border: isEnd ? 'none' : `2px solid ${r.color}44`, boxShadow: isEnd ? `0 0 6px ${r.color}44` : 'none', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: isEnd ? 17 : 15, fontWeight: isEnd ? 800 : 400, color: isEnd ? 'var(--tx)' : 'var(--s2)' }}>{s.name}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: isEnd ? 15 : 13, fontWeight: isEnd ? 700 : 400, color: isEnd ? r.color : 'var(--s2)', width: 50, textAlign: 'center' }}>{s.arrival}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: isEnd ? 15 : 13, fontWeight: isEnd ? 700 : 400, color: isEnd ? r.color : 'var(--s2)', width: 50, textAlign: 'center' }}>{s.departure}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══ STATION RESULT ═══
  const renderStationResult = () => {
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const filtered = stnDir === 'dep' ? stationTT : stationTT;
    const nextI = filtered.findIndex(t => t.departure >= nowStr);
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader} style={{ borderBottom: `1px solid var(--bd)` }}>
          <div className={styles.headerRow}>
            <button className={styles.backBtn} onClick={() => setScreen('home')}>&larr;</button>
            <span className={styles.headerSub}>車站查詢</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--tx)' }}>{stnQ?.name}</div>
          <div className={styles.typeMeta}>{filtered.length} 班次 · {stnDir === 'dep' ? '出發' : '到達'}列車</div>
        </div>
        <div className={styles.trainScroll} ref={scrollRef}>
          {filtered.map((t, i) => (
            <div key={`${t.trainNo}-${i}`} data-train-row style={{
              display: 'flex', alignItems: 'center', padding: '14px 0', gap: 10,
              borderBottom: '1px solid color-mix(in srgb, var(--bd) 15%, transparent)',
              position: 'relative',
            }}>
              {i === nextI && <div style={{ position: 'absolute', left: -16, top: 0, bottom: 0, width: 3, borderRadius: 2, background: 'var(--c-ok)' }} />}
              <div style={{ width: 52, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--fm)', fontWeight: 600, color: t.color }}>#{t.trainNo}</div>
                {i === nextI && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-ok)' }}>下一班</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--fm)', color: 'var(--tx)' }}>{t.departure}</div>
                <div style={{ fontSize: 12, color: 'var(--s2)', marginTop: 2 }}>{t.typeName} → {t.destination}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

    </div>
  );
}
