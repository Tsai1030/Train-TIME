import { useState, useEffect, useRef } from 'react';
import { fuzzyMatch, type Station, type Region } from '../../hooks/useStations';
import styles from './StationPicker.module.css';

interface Props {
  open: boolean;
  label: string;
  regions: Region[];
  allStations: Station[];
  onPick: (s: Station) => void;
  onClose: () => void;
}

export function StationPicker({ open, label, regions, allStations, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [openRegions, setOpenRegions] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
    if (!open) { setQuery(''); setOpenRegions({}); }
  }, [open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const filtered = hasQuery ? allStations.filter(s => fuzzyMatch(query, s)) : [];
  const toggleRegion = (name: string) => setOpenRegions(p => ({ ...p, [name]: !p[name] }));

  const pick = (s: Station) => { onPick(s); onClose(); };

  return (
    <div className={styles.root}>
      <div className={styles.searchRow}>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`搜尋${label}`}
        />
        <button className={styles.cancel} onClick={onClose}>取消</button>
      </div>

      <div className={styles.list}>
        {hasQuery ? (
          <>
            <div className={styles.countLabel}>{filtered.length} 個結果</div>
            {filtered.map(s => (
              <div key={s.id} className={styles.stationRow} onClick={() => pick(s)}>
                <div>
                  <span className={s.major ? styles.majorName : styles.minorName}>{s.name}</span>
                  <span className={styles.regionTag}>{s.city}</span>
                </div>
                <span className={styles.code}>{s.id}</span>
              </div>
            ))}
          </>
        ) : (
          regions.map(r => (
            <div key={r.name}>
              <div className={styles.regionRow} onClick={() => toggleRegion(r.name)}>
                <span className={styles.regionName}>{r.name}</span>
                <div className={styles.regionMeta}>
                  <span className={styles.regionCount}>{r.stations.length} 站</span>
                  <span className={`${styles.arrow} ${openRegions[r.name] ? styles.arrowOpen : ''}`}>&rsaquo;</span>
                </div>
              </div>
              {openRegions[r.name] && (
                <div className={styles.chips}>
                  {r.stations.map(s => (
                    <button
                      key={s.id}
                      className={`${styles.chip} ${s.major ? styles.chipMajor : ''}`}
                      onClick={() => pick(s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
