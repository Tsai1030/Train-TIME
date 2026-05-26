import { TRAIN_TYPE_INFO, type ParsedTrain } from '../../services/tdx';
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

  return (
    <div className={styles.row} style={{ animationDelay: `${index * 0.03}s` }} onClick={onClick} data-train-row>
      {isNext && <div className={styles.nextLine} />}

      <div className={styles.noCol}>
        <div className={styles.trainNo} style={{ color }}>#{train.trainNo}</div>
        {isNext && <span className={styles.nextTag}>下一班</span>}
      </div>

      <div className={styles.timeRow}>
        <span className={styles.time}>{train.departure}</span>
        <div className={styles.durArrow}>
          <span className={styles.durText}>{fmtDur(train.durationMin)}</span>
          <span className={styles.arrowLine}>&rarr;</span>
        </div>
        <span className={styles.time}>{train.arrival}</span>
      </div>

      <span className={delayed ? styles.statusWarn : styles.statusOk}>
        {delayed ? `晚${delayMin}分` : '準點'}
      </span>
      {price > 0 && <span className={styles.price}>${price}</span>}
    </div>
  );
}
