import styles from './BottomNav.module.css';

export type Tab = 's2s' | 'train' | 'stn' | 'commute';

interface Props {
  tab: Tab;
  onChange: (t: Tab) => void;
}

const ICONS: Record<Tab, React.ReactNode> = {
  s2s: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="6" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M5.5 8.5V14a3 3 0 0 0 3 3h7" />
      <path d="M13 14.5 15.5 17 13 19.5" />
    </svg>
  ),
  train: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3.5" width="14" height="13" rx="3" />
      <path d="M5 10h14" />
      <path d="M9 16.5 7 20.5M15 16.5l2 4" />
      <circle cx="9" cy="13.2" r="0.6" fill="currentColor" />
      <circle cx="15" cy="13.2" r="0.6" fill="currentColor" />
    </svg>
  ),
  stn: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20.5V9.8L12 4l8 5.8v10.7" />
      <path d="M2.5 20.5h19" />
      <path d="M9 20.5v-5h6v5" />
      <path d="M12 9.5h.01" />
    </svg>
  ),
  commute: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = { s2s: '站到站', train: '車次', stn: '車站', commute: '通勤' };

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav className={styles.dock}>
      {(Object.keys(LABELS) as Tab[]).map(k => (
        <button
          key={k}
          className={`${styles.item} ${tab === k ? styles.active : ''}`}
          onClick={() => onChange(k)}
          aria-label={LABELS[k]}
        >
          <span className={styles.icon}>{ICONS[k]}</span>
          <span className={styles.label}>{LABELS[k]}</span>
          {tab === k && <span className={styles.glow} />}
        </button>
      ))}
    </nav>
  );
}
