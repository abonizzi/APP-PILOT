import { supabase } from './supabase';
import type { ProjectStatus, StepStatus } from './domain';

export interface Project {
  id: string; name: string; description: string | null; icon: string | null; tags: string[];
  status: ProjectStatus; created_at: string; updated_at: string;
}
export type ProjectRow = Project & { project_checklist_items: { status: StepStatus }[] };

export const DEFAULT_STEPS: [string, string, string][] = [
  ['Prompt e specifica su ChatGPT', 'Ideazione e design', 'Sparkles'],
  ['Progettazione e visualizzazione dell\'interfaccia', 'Ideazione e design', 'Layout'],
  ['Creazione dell\'icona', 'Ideazione e design', 'Image'],
  ['Generazione e revisione del codice con Claude', 'Sviluppo', 'Code'],
  ['Verifica del funzionamento in locale', 'Sviluppo', 'MonitorCheck'],
  ['Creazione e configurazione del progetto Supabase', 'Backend e servizi', 'Database'],
  ['Collegamento del database e verifica delle policy', 'Backend e servizi', 'ShieldCheck'],
  ['Configurazione di Resend, se necessaria', 'Backend e servizi', 'Mail'],
  ['Creazione del repository GitHub', 'Versionamento', 'Github'],
  ['Primo commit e verifica del repository', 'Versionamento', 'GitCommit'],
  ['Configurazione di Netlify', 'Pubblicazione', 'Globe'],
  ['Collegamento del repository', 'Pubblicazione', 'Link'],
  ['Configurazione delle variabili d\'ambiente', 'Pubblicazione', 'KeyRound'],
  ['Deploy', 'Pubblicazione', 'Rocket'],
  ['Verifica del sito pubblicato', 'Pubblicazione', 'BadgeCheck'],
];

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase.from('projects')
    .select('*, project_checklist_items(status)').is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as ProjectRow[];
}

async function seedSteps(projectId: string) {
  const { data: tpls, error: te } = await supabase.from('checklist_templates').select('*').eq('is_enabled', true).order('sort_order');
  if (te) throw te;
  const items = tpls && tpls.length
    ? tpls.map((t, i) => ({ project_id: projectId, template_id: t.id, name: t.name, description: t.description, category: t.category, icon: t.icon, sort_order: i }))
    : DEFAULT_STEPS.map(([name, category, icon], i) => ({ project_id: projectId, name, category, icon, sort_order: i }));
  const { error } = await supabase.from('project_checklist_items').insert(items); if (error) throw error;
}

/** Copia indipendente in stato Idea; note, checklist (azzerata a "Da fare") e link sono opzionali. */
export async function duplicateProject(src: Project, o: { notes: boolean; checklist: boolean; links: boolean }) {
  const { data: np, error } = await supabase.from('projects').insert({ name: `${src.name} (copia)`, description: src.description, icon: src.icon, tags: src.tags, status: 'idea' }).select().single();
  if (error) throw error;
  const pid = np.id as string;
  if (o.checklist) {
    const { data, error: e } = await supabase.from('project_checklist_items').select('template_id,name,description,category,icon,sort_order,link,custom_data').eq('project_id', src.id); if (e) throw e;
    if (data?.length) { const { error: e2 } = await supabase.from('project_checklist_items').insert(data.map(r => ({ ...r, project_id: pid, status: 'todo' }))); if (e2) throw e2; }
  } else await seedSteps(pid);
  if (o.notes) {
    const { data, error: e } = await supabase.from('project_notes').select('type,title,content,is_resolved').eq('project_id', src.id); if (e) throw e;
    if (data?.length) { const { error: e2 } = await supabase.from('project_notes').insert(data.map(r => ({ ...r, project_id: pid }))); if (e2) throw e2; }
  }
  if (o.links) {
    const { data, error: e } = await supabase.from('project_links').select('title,url,category,notes').eq('project_id', src.id); if (e) throw e;
    if (data?.length) { const { error: e2 } = await supabase.from('project_links').insert(data.map(r => ({ ...r, project_id: pid }))); if (e2) throw e2; }
  }
  return np as Project;
}

/** Crea il progetto e copia i modelli abilitati (o quelli predefiniti) come step indipendenti. */
export async function createProject(p: { name: string; description?: string; icon?: string; status: ProjectStatus; tags: string[] }) {
  const { data: proj, error } = await supabase.from('projects').insert({
    name: p.name.trim(), description: p.description?.trim() || null, icon: p.icon || '🚀', status: p.status, tags: p.tags,
  }).select().single();
  if (error) throw error;
  await seedSteps(proj.id); // se fallisce, il progetto esiste ma senza step: l'errore è mostrato, nulla è dichiarato riuscito
  return proj as Project;
}

export async function setStatus(id: string, status: ProjectStatus) {
  const { error } = await supabase.from('projects').update({ status }).eq('id', id); if (error) throw error;
}
export async function archiveProject(id: string) {
  const { error } = await supabase.from('projects').update({ archived_at: new Date().toISOString() }).eq('id', id); if (error) throw error;
}
export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id); if (error) throw error;
}

/** Aggiunge a un progetto esistente solo gli step dei modelli attivi che mancano; non tocca quelli già presenti (né i completati). */
export async function applyTemplates(projectId: string): Promise<number> {
  const { data: tpls, error } = await supabase.from('checklist_templates').select('*').eq('is_enabled', true).order('sort_order'); if (error) throw error;
  const { data: have, error: e2 } = await supabase.from('project_checklist_items').select('template_id,name,sort_order').eq('project_id', projectId); if (e2) throw e2;
  const ids = new Set((have ?? []).map((h: { template_id: string | null }) => h.template_id).filter(Boolean));
  const names = new Set((have ?? []).map((h: { name: string }) => h.name));
  let next = Math.max(-1, ...(have ?? []).map((h: { sort_order: number }) => h.sort_order)) + 1;
  const fresh = (tpls ?? []).filter((t: { id: string; name: string }) => !ids.has(t.id) && !names.has(t.name));
  if (!fresh.length) return 0;
  const { error: e3 } = await supabase.from('project_checklist_items').insert(fresh.map((t: { id: string; name: string; description: string | null; category: string | null; icon: string | null }) =>
    ({ project_id: projectId, template_id: t.id, name: t.name, description: t.description, category: t.category, icon: t.icon, sort_order: next++ })));
  if (e3) throw e3;
  return fresh.length;
}
