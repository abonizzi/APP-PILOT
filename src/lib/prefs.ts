import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

// Solo preferenze di interfaccia (nessun segreto): localStorage per l'avvio immediato + profilo Supabase per la sincronia tra dispositivi.
export interface Prefs { theme: 'dark' | 'light' | 'auto'; preview: 'pc' | 'phone' }
const KEY = 'apppilot.prefs', DEF: Prefs = { theme: 'dark', preview: 'pc' };
const read = (): Prefs => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEF; } };
let prefs = read(); const subs = new Set<() => void>();

export function applyTheme() {
  const dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('light', !dark);
}
const commit = (p: Prefs) => { prefs = p; localStorage.setItem(KEY, JSON.stringify(p)); applyTheme(); subs.forEach(f => f()); };
export const usePrefs = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => prefs);

async function remote() {
  const { data: u } = await supabase.auth.getUser(); if (!u.user) throw new Error('Sessione non valida.');
  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return { id: u.user.id, all: (data?.preferences ?? {}) as Record<string, unknown> };
}
/** Salva in locale subito e sul server; il chiamante mostra l'esito del salvataggio remoto. */
export async function setPrefs(patch: Partial<Prefs>) {
  commit({ ...prefs, ...patch });
  const { id, all } = await remote();
  const { error } = await supabase.from('profiles').upsert({ id, preferences: { ...all, ui: prefs } });
  if (error) throw new Error(error.message);
}
export async function loadRemotePrefs() { try { const { all } = await remote(); if (all.ui) commit({ ...DEF, ...(all.ui as Partial<Prefs>) }); } catch { /* resta il valore locale */ } }

if (typeof window !== 'undefined') { applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); }
