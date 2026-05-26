import styles from './Chips.module.css';

interface Option {
  v: string;
  l: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}

export function Chips({ options, value, onChange }: Props) {
  return (
    <div className={styles.row}>
      {options.map(o => (
        <button
          key={o.v}
          className={`${styles.chip} ${value === o.v ? styles.active : ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
