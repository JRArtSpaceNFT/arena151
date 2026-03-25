'use client';

import { useState, useEffect, useRef } from 'react';

// Fallback price if fetch fails
const FALLBACK_SOL_PRICE = 90.57;
const REFRESH_INTERVAL_MS = 60_000;

export function useSolPrice() {
  const [solPrice, setSolPrice] = useState<number>(FALLBACK_SOL_PRICE);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrice = async () => {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const price = data?.solana?.usd;
      if (typeof price === 'number' && price > 0) {
        setSolPrice(price);
        setLastUpdated(new Date());
      }
    } catch {
      // Keep last known price on failure — silent fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    intervalRef.current = setInterval(fetchPrice, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { solPrice, loading, lastUpdated };
}
