import { TRAIN_TYPE_INFO, type ParsedTrain } from '../../services/tdx';
import { useNow, untilDeparture, fmtCountdown } from '../../hooks/useNow';
import styles from './TypeCard.module.css';

interface Props {
  typeKey: string;
  trains: ParsedTrain[];
  farePrice: number;
  index: number;
  nextIdx: number | null;
  onClick: () => void;
}

export function TypeCard({ typeKey, trains, farePrice, index, nextIdx, onClick }: Props) {
  const tc = TRAIN_TYPE_INFO[typeKey] || { color: '#888', name: typeKey, seat: 'f' };
  const now = useNow();
  const fastest = Math.min(...trains.map(t => t.durationMin));
  const fH = Math.floor(fastest / 60);
  const fM = String(fastest % 60).padStart(2, '0');
  const next = nextIdx !== null ? trains[nextIdx] : null;
  const cd = next ? untilDeparture(next.departure, now) : null;

  return (
    <div
      className={styles.card}
      style={{ animationDelay: `${index * 0.07}s`, '--type-c': tc.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className={styles.rail} />
      <div className={styles.top}>
        <div className={styles.typeInfo}>
          <span className={styles.typeName}>{tc.name}</span>
          {tc.tag && <span className={styles.tag}>{tc.tag}</span>}
        </div>
        <div className={styles.topRight}>
          {farePrice > 0 && <span className={styles.price}>${farePrice}</span>}
          <span className={styles.moreArrow}>&rsaquo;</span>
        </div>
      </div>

      <div className={styles.stats}>
        <div>
          <div className={styles.statLabel}>班次</div>
          <div className={styles.statVal}>{trains.length}</div>
        </div>
        <div className={styles.divider} />
        <div>
          <div className={styles.statLabel}>最快</div>
          <div className={styles.statVal}>{fH}h{fM}m</div>
        </div>
        <div className={styles.divider} />
        <div>
          <div className={styles.statLabel}>首班 / 末班</div>
          <div className={styles.statVal}>{trains[0]?.departure} / {trains[trains.length - 1]?.departure}</div>
        </div>
      </div>

      {next && (
        <div className={styles.nextBadge}>
          <span className={styles.nextDot} />
          <span className={styles.nextLabel}>下一班</span>
          <span className={styles.nextTime}>{next.departure}</span>
          {cd !== null && cd < 3600 * 3 && <span className={styles.nextCd}>{fmtCountdown(cd)} 後</span>}
          <span className={styles.nextNo}>#{next.trainNo}</span>
        </div>
      )}
    </div>
  );
}
