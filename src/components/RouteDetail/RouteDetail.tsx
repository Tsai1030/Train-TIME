import { useState } from 'react';
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

function scheduleReminder(train: ParsedTrain, from: string, minutesBefore: number) {
  const [h, m] = train.departure.split(':').map(Number);
  const depMs = new Date().setHours(h, m, 0, 0);
  const alertMs = depMs - minutesBefore * 60 * 1000;
  const delay = alertMs - Date.now();
  if (delay <= 0) { alert('此班次即將發車或已過發車時間'); return false; }
  if (!('Notification' in window)) { alert('此瀏覽器不支援通知功能'); return false; }
  Notification.requestPermission().then(perm => {
    if (perm === 'granted') {
      setTimeout(() => {
        new Notification(`🚂 ${train.typeName} #${train.trainNo}`, {
          body: `${from} ${train.departure} 發車，還有 ${minutesBefore} 分鐘`,
          icon: '/train_logo_icon.svg',
        });
      }, delay);
    }
  });
  return true;
}

export function RouteDetail({ train, stops, from, to, farePrice, delayMin, onBack }: Props) {
  const tc = TRAIN_TYPE_INFO[train.typeCode] || { color: '#888', name: train.typeName };
  const delayed = delayMin > 0;
  const [reminded, setReminded] = useState(false);

  const handleReminder = () => {
    if (scheduleReminder(train, from, 10)) setReminded(true);
  };

  const chips = [
    { l: '出發', v: train.departure, c: tc.color },
    { l: '抵達', v: train.arrival, c: 'var(--tx)' },
    { l: '票價', v: farePrice > 0 ? `$${farePrice}` : '-', c: tc.color },
    { l: '行車', v: fmtDur(train.durationMin), c: 'var(--tx)' },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button className={styles.back} onClick={onBack}>&larr;</button>
        <div>
          <div className={styles.headerSub}>班次詳情</div>
          <div className={styles.headerTitle}>{train.typeName} #{train.trainNo}</div>
        </div>
        <button className={`${styles.remindBtn} ${reminded ? styles.reminded : ''}`} onClick={handleReminder} disabled={reminded}>
          {reminded ? '已設提醒' : '到站提醒'}
        </button>
      </div>

      <div className={styles.hero}>
        <div className={styles.route}>
          <span className={styles.stationName}>{from}</span>
          <span className={styles.routeArrow}>&rarr;</span>
          <span className={styles.stationName}>{to}</span>
        </div>
        <div className={styles.chipRow}>
          {chips.map((ch, i) => (
            <div key={i} className={styles.chip}>
              <div className={styles.chipLabel}>{ch.l}</div>
              <div className={styles.chipVal} style={{ color: ch.c }}>{ch.v}</div>
            </div>
          ))}
        </div>
        {train.headSign && <div className={styles.headSign}>{train.headSign}</div>}
      </div>

      <div className={styles.colHeader}>
        <span className={styles.colStation}>停靠站</span>
        {delayed && <span className={styles.colWarn}>預估晚{delayMin}分</span>}
        <span className={styles.colTime}>到站</span>
        <span className={styles.colTime}>離站</span>
      </div>
      <div className={styles.stopsScroll}>
        {stops.length === 0 && <div className={styles.loading}>載入中...</div>}
        {stops.length > 0 && (
          <div className={styles.nodeWrap}>
            <div className={styles.line} style={{ background: `linear-gradient(180deg, ${tc.color}, ${tc.color}25)` }} />
            {stops.map((s, i) => {
              const isEnd = i === 0 || i === stops.length - 1;
              return (
                <div key={i} className={styles.stopRow} style={{ animationDelay: `${i * 0.02}s` }}>
                  <div
                    className={isEnd ? styles.nodeEnd : styles.nodeMiddle}
                    style={isEnd ? { background: tc.color, boxShadow: `0 0 6px ${tc.color}44` } : { borderColor: `${tc.color}44` }}
                  />
                  <span className={isEnd ? styles.stopNameEnd : styles.stopNameMid}>{s.name}</span>
                  <span className={isEnd ? styles.stopTimeEnd : styles.stopTimeMid}>{s.arrival}</span>
                  <span className={isEnd ? styles.stopTimeEnd : styles.stopTimeMid} style={isEnd ? { color: tc.color } : {}}>{s.departure}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
