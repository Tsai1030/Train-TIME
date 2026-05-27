import { useState, useCallback } from 'react';
import type { Station } from './useStations';

export interface CommuteRoute {
  from: Station;
  to: Station;
}

const KEY = 'pulse-commutes';

function load(): CommuteRoute[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(routes: CommuteRoute[]) {
  localStorage.setItem(KEY, JSON.stringify(routes));
}

export function useCommute() {
  const [commutes, setCommutes] = useState<CommuteRoute[]>(load);

  const addCommute = useCallback((route: CommuteRoute) => {
    setCommutes(prev => {
      const exists = prev.some(r => r.from.id === route.from.id && r.to.id === route.to.id);
      if (exists) return prev;
      const next = [...prev, route];
      save(next);
      return next;
    });
  }, []);

  const removeCommute = useCallback((index: number) => {
    setCommutes(prev => {
      const next = prev.filter((_, i) => i !== index);
      save(next);
      return next;
    });
  }, []);

  return { commutes, addCommute, removeCommute };
}
