import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Settings from './pages/Settings';
import SupabaseAccounts from './pages/SupabaseAccounts';
import { loadRemotePrefs } from './lib/prefs';
import { useEffect } from 'react';
import { isConfigured } from './lib/supabase';

export default function App() {
  const { session, loading } = useAuth();
  const uid = session?.user.id;
  useEffect(() => { if (uid) loadRemotePrefs(); }, [uid]);
  if (!isConfigured) return <p className="p-6">Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (vedi .env.example).</p>;
  if (loading) return <p className="p-6 text-slate-400">Caricamento…</p>;
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route element={session ? <Layout email={session.user.email ?? ''} /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/progetti/:id" element={<ProjectDetail />} />
        <Route path="/impostazioni" element={<Settings />} />
        <Route path="/account-supabase" element={<SupabaseAccounts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
