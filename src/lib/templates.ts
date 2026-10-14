import { supabase } from './supabase';
import { DEFAULT_STEPS } from './projects';

export interface Template { id: string; name: string; description: string | null; category: string | null; icon: string | null; sort_order: number; is_enabled: boolean; is_required: boolean }
type R<T> = { data: T | null; error: { message: string } | null };
const ok = <T,>(r: R<T>): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export const listTemplates = async () => ok(await supabase.from('checklist_templates').select('*').order('sort_order')) as Template[];
export type TemplateFields = Pick<Template, 'name' | 'description' | 'category' | 'icon' | 'is_required'>;
export const addTemplate = async (f: TemplateFields, order: number) => { ok(await supabase.from('checklist_templates').insert({ ...f, sort_order: order }).select().single()); };
export const updateTemplate = async (id: string, patch: Partial<Template>) => { ok(await supabase.from('checklist_templates').update(patch).eq('id', id).select().single()); };
/** Gli step già copiati nei progetti restano: template_id diventa null (ON DELETE SET NULL). */
export const deleteTemplate = async (id: string) => { ok(await supabase.from('checklist_templates').delete().eq('id', id).select()); };
export async function swapOrder(a: Template, b: Template) {
  await updateTemplate(a.id, { sort_order: b.sort_order }); await updateTemplate(b.id, { sort_order: a.sort_order });
}
export async function seedDefaults() {
  ok(await supabase.from('checklist_templates').insert(DEFAULT_STEPS.map(([name, category, icon], i) => ({ name, category, icon, sort_order: i }))).select());
}
