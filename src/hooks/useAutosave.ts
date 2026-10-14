import { useEffect, useRef, useState } from 'react';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** Debounce: "Salvato" compare solo dopo la conferma del server; in caso di errore il testo resta nel campo. */
export function useAutosave(value: string, save: (v: string) => Promise<void>, delay = 800) {
  const last = useRef(value); const [state, setState] = useState<SaveState>('saved'); const [tick, setTick] = useState(0);
  useEffect(() => {
    if (value === last.current) { setState('saved'); return; }
    setState('dirty');
    const t = setTimeout(async () => {
      setState('saving');
      try { await save(value); last.current = value; setState(s => (s === 'saving' ? 'saved' : s)); }
      catch { setState('error'); }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, tick]);
  return { state, retry: () => setTick(n => n + 1) };
}
