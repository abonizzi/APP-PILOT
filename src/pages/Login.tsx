import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg({ ok: false, text: error.message === 'Invalid login credentials' ? 'Email o password non corrette.' : 'Accesso non riuscito: ' + error.message });
    setBusy(false); // in caso di successo useAuth reindirizza alla dashboard
  }
  async function reset() {
    if (!email) return setMsg({ ok: false, text: 'Inserisci prima la tua email.' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Se l\'account esiste, riceverai una email per reimpostare la password.' });
  }
  return (
    <div className="flex h-full items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-edge bg-panel p-6">
        <div className="flex items-center gap-3"><img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <h1 className="text-xl font-semibold text-white">AppPilot</h1></div>
        <label className="block text-sm">Email<input className="field mt-1" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block text-sm">Password<input className="field mt-1" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {msg && <p role="alert" className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
        <button type="button" onClick={reset} className="w-full text-center text-sm text-slate-400 hover:text-white">Password dimenticata?</button>
      </form>
    </div>
  );
}
