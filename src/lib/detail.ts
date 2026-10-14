import { supabase } from './supabase';
import type { StepStatus } from './domain';
import type { Project } from './projects';

export interface ProjectFull extends Project { public_url: string | null; repository_url: string | null; published_at: string | null }
export interface Item { id: string; name: string; description: string | null; category: string | null; status: StepStatus; sort_order: number; completed_at: string | null }
export interface Note { id: string; type: 'completed' | 'future_improvements'; content: string; is_resolved: boolean; created_at: string; updated_at: string }
export interface ProjLink { id: string; title: string; url: string; category: string | null }

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export const getProject = async (id: string) => ok(await supabase.from('projects').select('*').eq('id', id).single()) as ProjectFull;
export const updateProject = async (id: string, patch: Partial<ProjectFull>) => { ok(await supabase.from('projects').update(patch).eq('id', id).select().single()); };
export const listItems = async (id: string) => ok(await supabase.from('project_checklist_items').select('*').eq('project_id', id).order('sort_order')) as Item[];
export const setItemStatus = async (id: string, status: StepStatus) => {
  ok(await supabase.from('project_checklist_items').update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id).select().single());
};
export const listNotes = async (id: string) => ok(await supabase.from('project_notes').select('*').eq('project_id', id).order('created_at')) as Note[];
export const addNote = async (project_id: string, type: Note['type']) => ok(await supabase.from('project_notes').insert({ project_id, type, content: '' }).select().single()) as Note;
export const saveNote = async (id: string, patch: Partial<Pick<Note, 'content' | 'is_resolved'>>) => { ok(await supabase.from('project_notes').update(patch).eq('id', id).select().single()); };
export const deleteNote = async (id: string) => { ok(await supabase.from('project_notes').delete().eq('id', id).select()); };
export const listLinks = async (id: string) => ok(await supabase.from('project_links').select('*').eq('project_id', id).order('created_at')) as ProjLink[];
export const addLink = async (project_id: string, l: { title: string; url: string; category?: string }) => ok(await supabase.from('project_links').insert({ project_id, ...l }).select().single()) as ProjLink;
export const deleteLink = async (id: string) => { ok(await supabase.from('project_links').delete().eq('id', id).select()); };

/** Solo HTTPS. Restituisce l'URL normalizzato o null. */
export function safeHttps(raw: string): string | null {
  try { const u = new URL(raw.trim()); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}
