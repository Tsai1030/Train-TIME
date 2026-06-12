import { useState, useEffect } from 'react';

/** 每秒跳動的現在時間 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** 距離 HH:MM 出發還有多久；已過回傳 null */
export function untilDeparture(dep: string, now: Date): number | null {
  const [h, m] = dep.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const sec = Math.floor((target.getTime() - now.getTime()) / 1000);
  return sec >= 0 ? sec : null;
}

export function fmtCountdown(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)} 時 ${Math.floor((sec % 3600) / 60)} 分`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
