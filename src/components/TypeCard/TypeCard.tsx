import { TRAIN_TYPE_INFO, type ParsedTrain } from '../../services/tdx';
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
  const fastest = Math.min(...trains.map(t => t.durationMin));
  const fH = Math.floor(fastest / 60);
  const fM = String(fastest % 60).padStart(2, '0');

  return (
    <div className={styles.card} style={{ animationDelay: `${index * 0.05}s` }} onClick={onClick}>
      <div className={styles.top}>
        <div className={styles.typeInfo}>
          <span className={styles.typeName} style={{ color: tc.color }}>{tc.name}</span>
          {typeKey === 'emu3000' && <span className={styles.freeSeat}>提供自由座</span>}
          <span className={styles.count}>{trains.length} 班</span>
        </div>
        {farePrice > 0 && <span className={styles.price}>${farePrice}</span>}
      </div>

      <div className={styles.stats}>
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

      {nextIdx !== null && (
        <div className={styles.nextBadge}>
          <span className={styles.nextLabel}>下一班</span>
          <span className={styles.nextTime}>{trains[nextIdx].departure}</span>
          <span className={styles.nextArr}>&rarr;{trains[nextIdx].arrival}</span>
          <span className={styles.nextNo}>#{trains[nextIdx].trainNo}</span>
        </div>
      )}

      <div className={styles.more}>所有班次 &rsaquo;</div>
    </div>
  );
}
