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

function bookingUrl(trainNo: string): string {
  return `https://tip.railway.gov.tw/tra-tip-web/tip/tip001/tip112/querybytime`;
}

export function TrainRow({ train, isNext, index, price, delayMin, onClick }: Props) {
  const tc = TRAIN_TYPE_INFO[train.typeCode];
  const color = tc?.color ?? '#888';
  const delayed = delayMin > 0;
  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const arrived = train.arrival <= nowStr;
  const isReserved = tc?.seat === 'r';

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

  const handleBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(bookingUrl(train.trainNo), '_blank');
  };

  return (
    <div className={`${styles.row} ${arrived ? styles.rowDone : ''}`} style={{ animationDelay: `${index * 0.03}s` }} onClick={onClick} data-train-row>
      {isNext && <div className={styles.nextLine} />}

      <div className={styles.noCol}>
        <div className={styles.trainNo} style={{ color: arrived ? 'var(--s3)' : color }}>#{train.trainNo}</div>
        {isNext && <span className={styles.nextTag}>下一班</span>}
      </div>

      <div className={styles.timeRow}>
        <span className={`${styles.time} ${arrived ? styles.timeDone : ''}`}>{train.departure}</span>
        <div className={styles.durArrow}>
          <span className={styles.durText}>{fmtDur(train.durationMin)}</span>
          <span className={styles.arrowLine}>&rarr;</span>
        </div>
        <span className={`${styles.time} ${arrived ? styles.timeDone : ''}`}>{train.arrival}</span>
      </div>

      <span className={statusClass}>{statusText}</span>
      {price > 0 && <span className={`${styles.price} ${arrived ? styles.priceDone : ''}`}>${price}</span>}
      {isReserved && !arrived && <button className={styles.bookBtn} onClick={handleBook}>訂票</button>}
    </div>
  );
}
