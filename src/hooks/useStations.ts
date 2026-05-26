import { useState, useEffect } from 'react';
import { fetchStations, type TdxStation } from '../services/tdx';

export interface Station {
  id: string;
  name: string;
  en: string;
  city: string;
  major: boolean;
}

export interface Region {
  name: string;
  stations: Station[];
}

const CACHE_KEY = 'pulse-stations';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const MAJOR_CLASSES = ['1', '2', '3'];

function groupByCity(stations: Station[]): Region[] {
  const map = new Map<string, Station[]>();
  for (const s of stations) {
    const list = map.get(s.city) || [];
    list.push(s);
    map.set(s.city, list);
  }
  const CITY_ORDER = [
    '基隆市', '新北市', '臺北市', '桃園市', '新竹市', '新竹縣',
    '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣',
    '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣',
    '宜蘭縣', '花蓮縣', '臺東縣',
  ];
  const regions: Region[] = [];
  for (const city of CITY_ORDER) {
    const list = map.get(city);
    if (list && list.length > 0) {
      regions.push({ name: city, stations: list });
    }
  }
  for (const [city, list] of map) {
    if (!CITY_ORDER.includes(city) && list.length > 0) {
      regions.push({ name: city, stations: list });
    }
  }
  return regions;
}

function toStation(s: TdxStation): Station {
  return {
    id: s.StationID,
    name: s.StationName.Zh_tw,
    en: s.StationName.En,
    city: s.LocationCity,
    major: MAJOR_CLASSES.includes(s.StationClass),
  };
}

export function useStations() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            const stations = data as Station[];
            if (!cancelled) {
              setAllStations(stations);
              setRegions(groupByCity(stations));
              setLoading(false);
            }
            return;
          }
        }
      } catch { /* ignore cache errors */ }

      try {
        const raw = await fetchStations();
        const stations = raw.map(toStation);
        if (!cancelled) {
          setAllStations(stations);
          setRegions(groupByCity(stations));
          setLoading(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: stations, ts: Date.now() }));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load stations');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { regions, allStations, loading, error };
}

export function fuzzyMatch(query: string, station: Station): boolean {
  const q = query.toLowerCase();
  return station.name.includes(q) || station.en.toLowerCase().includes(q) || station.id.includes(q) || station.city.includes(q);
}
