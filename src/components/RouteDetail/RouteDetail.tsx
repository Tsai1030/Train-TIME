import { TRAIN_TYPE_INFO, type ParsedTrain, type TrainStop } from '../../services/tdx';
import styles from './RouteDetail.module.css';

interface Props {
  train: ParsedTrain;
  stops: TrainStop[];
  from: string;
  to: string;
  farePrice: number;
  delayMin: number;
  onBack: () => void;
}

function fmtDur(m: number) {
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

export function RouteDetail({ train, stops, from, to, farePrice, delayMin, onBack }: Props) {
  const tc = TRAIN_TYPE_INFO[train.typeCode] || { color: '#888', name: train.typeName };
  const delayed = delayMin > 0;

  const chips = [
    { l: '票價', v: farePrice > 0 ? `$${farePrice}` : '—' },
    { l: '行車時間', v: fmtDur(train.durationMin) },
    { l: '停靠', v: `${stops.length || '—'} 站` },
  ];

  return (
    <div className={styles.root} style={{ '--type-c': tc.color } as React.CSSProperties}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="返回">&larr;</button>
        <div>
          <div className={styles.headerSub}>班次詳情</div>
          <div className={styles.headerTitle}>
            <span style={{ color: tc.color }}>{train.typeName}</span> #{train.trainNo}
          </div>
        </div>
        {delayed && <span className={styles.delayBadge}>晚 {delayMin} 分</span>}
      </div>

      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.route}>
          <div className={styles.endpoint}>
            <div className={styles.epLabel}>出發</div>
            <div className={styles.epName}>{from}</div>
            <div className={styles.epTime}>{train.departure}</div>
          </div>
          <div className={styles.routeMid}>
            <svg viewBox="0 0 60 12" className={styles.routeSvg}>
              <line x1="2" y1="6" x2="50" y2="6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" className={styles.routeDash} />
              <path d="M49 2l7 4-7 4" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
            <span className={styles.routeDur}>{fmtDur(train.durationMin)}</span>
          </div>
          <div className={styles.endpoint}>
            <div className={styles.epLabel}>抵達</div>
            <div className={styles.epName}>{to}</div>
            <div className={styles.epTimeArr}>{train.arrival}</div>
          </div>
        </div>
        <div className={styles.chipRow}>
          {chips.map((ch, i) => (
            <div key={i} className={styles.chip}>
              <span className={styles.chipLabel}>{ch.l}</span>
              <span className={styles.chipVal}>{ch.v}</span>
            </div>
          ))}
        </div>
        {train.headSign && <div className={styles.headSign}>{train.headSign}</div>}
      </div>

      <div className={styles.colHeader}>
        <span className={styles.colStation}>停靠站</span>
        <span className={styles.colTime}>到站</span>
        <span className={styles.colTime}>離站</span>
      </div>
      <div className={styles.stopsScroll}>
        {stops.length === 0 && <div className={styles.loading}>載入路線中...</div>}
        {stops.length > 0 && (
          <div className={styles.nodeWrap}>
            <div className={styles.line} />
            {stops.map((s, i) => {
              const isEnd = i === 0 || i === stops.length - 1;
              const isOrigin = s.name === from;
              const isDest = s.name === to;
              const hot = isOrigin || isDest;
              return (
                <div key={i} className={styles.stopRow} style={{ animationDelay: `${Math.min(i, 20) * 0.03}s` }}>
                  <div className={`${isEnd || hot ? styles.nodeEnd : styles.nodeMiddle} ${hot ? styles.nodeHot : ''}`} />
                  <span className={isEnd || hot ? styles.stopNameEnd : styles.stopNameMid}>
                    {s.name}
                    {isOrigin && <em className={styles.hotTag}>上車</em>}
                    {isDest && <em className={styles.hotTag}>下車</em>}
                  </span>
                  <span className={isEnd || hot ? styles.stopTimeEnd : styles.stopTimeMid}>{s.arrival}</span>
                  <span className={isEnd || hot ? styles.stopTimeEnd : styles.stopTimeMid}>{s.departure}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
