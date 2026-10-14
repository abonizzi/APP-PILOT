import { supabase } from './supabase';
import type { PatchNotes, ProjectStatus } from './domain';

export interface Release {
  id: string; version_label: string; patch_title: string | null;
  patch_changes: string | null; patch_improvements: string | null; patch_fixes: string | null; patch_extra: string | null;
  status: 'draft' | 'published'; created_at: string; updated_at: string; published_at: string | null;
}
type R<T> = { data: T | null; error: { message: string } | null };
const ok = <T,>(r: R<T>): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export const listReleases = async (projectId: string) =>
  ok(await supabase.from('project_releases').select('*').eq('project_id', projectId).order('created_at', { ascending: false })) as Release[];

export const startUpdate = async (projectId: string) => { ok(await supabase.from('projects').update({ status: 'updating' }).eq('id', projectId).select().single()); };

/** Restituisce la riga letta dal server: la bozza è "salvata" solo dopo questa risposta. */
export async function saveDraft(projectId: string, id: string | null, title: string, n: PatchNotes): Promise<Release> {
  const row = { version_label: title.trim() || 'Bozza', patch_title: title.trim() || null, patch_changes: n.changes,
    patch_improvements: n.improvements ?? '', patch_fixes: n.fixes ?? '', patch_extra: n.extra ?? '', status: 'draft' };
  const q = id ? supabase.from('project_releases').update(row).eq('id', id) : supabase.from('project_releases').insert({ project_id: projectId, ...row });
  return ok(await q.select().single()) as Release;
}

/** Conferma MANUALE dell'utente: AppPilot non pubblica e non verifica nulla. */
export async function markPublished(p: { id: string; published_at: string | null }, releaseId: string, _from: ProjectStatus) {
  const now = new Date().toISOString();
  ok(await supabase.from('project_releases').update({ status: 'published', published_at: now }).eq('id', releaseId).select().single());
  ok(await supabase.from('projects').update({ status: 'deployed', last_deployed_at: now, published_at: p.published_at ?? now }).eq('id', p.id).select().single());
}
