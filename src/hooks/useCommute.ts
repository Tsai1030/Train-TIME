import { useState, useCallback } from 'react';
import type { Station } from './useStations';

export interface CommuteRoute {
  from: Station;
  to: Station;
}

const STORAGE_KEY = 'pulse-commute';

function load(): CommuteRoute | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useCommute() {
  const [commute, setCommuteState] = useState<CommuteRoute | null>(load);

  const setCommute = useCallback((route: CommuteRoute | null) => {
    setCommuteState(route);
    if (route) localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { commute, setCommute };
}
