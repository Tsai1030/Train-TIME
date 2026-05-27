import { useState, useCallback } from 'react';
import type { Station } from './useStations';

export interface CommuteRoute {
  from: Station;
  to: Station;
}

const KEY = 'pulse-commute';

function load(): CommuteRoute | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useCommute() {
  const [commute, setState] = useState<CommuteRoute | null>(load);

  const setCommute = useCallback((route: CommuteRoute | null) => {
    setState(route);
    if (route) localStorage.setItem(KEY, JSON.stringify(route));
    else localStorage.removeItem(KEY);
  }, []);

  return { commute, setCommute };
}
