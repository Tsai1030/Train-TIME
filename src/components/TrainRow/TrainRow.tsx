import { TRAIN_TYPE_INFO, type ParsedTrain } from '../../services/tdx';
import { useNow, untilDeparture, fmtCountdown } from '../../hooks/useNow';
import styles from './TrainRow.module.css';

interface Props {
  train: ParsedTrain;
  isNext: boolean;
  index: number;
  price: number;
  delayMin: number;
  onClick: () => void;
}

function fmtDur(m: number) {
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

export function TrainRow({ train, isNext, index, price, delayMin, onClick }: Props) {
  const tc = TRAIN_TYPE_INFO[train.typeCode];
  const color = tc?.color ?? '#888';
  const delayed = delayMin > 0;
  const now = useNow();
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const departed = train.departure < nowStr;
  const arrived = train.arrival <= nowStr;
  const cd = isNext ? untilDeparture(train.departure, now) : null;

  let statusText: string;
  let statusClass: string;
  if (arrived) {
    statusText = '已到站';
    statusClass = styles.statusDone;
  } else if (delayed) {
    statusText = `晚${delayMin}分`;
    statusClass = styles.statusWarn;
  } else {
    statusText = '準點';
    statusClass = styles.statusOk;
  }

  return (
    <div
      className={`${styles.row} ${arrived ? styles.rowDone : ''} ${isNext ? styles.rowNext : ''}`}
      style={{ animationDelay: `${Math.min(index, 14) * 0.035}s`, '--type-c': color } as React.CSSProperties}
      onClick={onClick}
      data-train-row
    >
      {/* 左側軌道時間軸 */}
      <div className={styles.railCol}>
        <span className={`${styles.node} ${departed ? styles.nodePast : ''} ${isNext ? styles.nodeNext : ''}`} />
      </div>

      <div className={styles.noCol}>
        <div className={styles.trainNo} style={{ color: arrived ? 'var(--s3)' : color }}>#{train.trainNo}</div>
        {isNext && cd !== null && <span className={styles.nextTag}>{fmtCountdown(cd)}</span>}
        {isNext && cd === null && <span className={styles.nextTag}>進站中</span>}
      </div>

      <div className={styles.timeRow}>
        <span className={`${styles.time} ${arrived ? styles.timeDone : ''}`}>{train.departure}</span>
        <div className={styles.durArrow}>
          <span className={styles.durText}>{fmtDur(train.durationMin)}</span>
          <svg className={styles.durSvg} viewBox="0 0 44 8" fill="none">
            <line x1="0" y1="4" x2="38" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
            <path d="M37 1l5 3-5 3" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </div>
        <span className={`${styles.time} ${arrived ? styles.timeDone : ''}`}>{train.arrival}</span>
      </div>

      <div className={styles.rightCol}>
        <span className={statusClass}>{statusText}</span>
        {price > 0 && <span className={`${styles.price} ${arrived ? styles.priceDone : ''}`}>${price}</span>}
      </div>
    </div>
  );
}
