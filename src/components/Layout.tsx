import { NavLink, Outlet } from 'react-router-dom';
import { Database, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { lock } from '../lib/vault';
import { usePrefs } from '../lib/prefs';

export default function Layout({ email }: { email: string }) {
  const phone = usePrefs().preview === 'phone'; // anteprima smartphone: layout stretto, solo simulazione
  const nav = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm';
  const link = ({ isActive }: { isActive: boolean }) => `${nav} ${isActive ? 'bg-accent/20 text-white' : 'hover:bg-white/5'}`;
  const out = () => { lock(); supabase.auth.signOut(); };
  return (
    <div className="h-full bg-black/30">
      <div className={`flex h-full flex-col bg-night ${phone ? 'mx-auto max-w-[420px] border-x border-edge' : 'md:flex-row'}`}>
        <aside className={`${phone ? 'hidden' : 'hidden md:flex'} w-56 shrink-0 flex-col border-r border-edge bg-panel p-3`}>
          <div className="flex items-center gap-2 px-2 py-3 text-lg font-semibold text-white"><img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" /> AppPilot</div>
          <NavLink to="/" end className={link}><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/account-supabase" className={link}><Database size={18} /> Account Supabase</NavLink>
          <NavLink to="/impostazioni" className={link}><Settings size={18} /> Impostazioni</NavLink>
          <div className="mt-auto border-t border-edge pt-3">
            <p className="truncate px-2 pb-2 text-xs text-slate-400">{email}</p>
            <button className={`${nav} w-full hover:bg-white/5`} onClick={out}><LogOut size={18} /> Esci</button>
          </div>
        </aside>
        <header className={`${phone ? 'flex' : 'flex md:hidden'} items-center justify-between border-b border-edge bg-panel px-4 py-3`}>
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-white"><img src="/icons/icon-192.png" alt="" className="h-7 w-7 rounded-md" />AppPilot</NavLink>
          <span className="flex"><NavLink to="/account-supabase" aria-label="Account Supabase" className="p-2"><Database size={20} /></NavLink><NavLink to="/impostazioni" aria-label="Impostazioni" className="p-2"><Settings size={20} /></NavLink>
            <button aria-label="Esci" className="p-2" onClick={out}><LogOut size={20} /></button></span>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
