export type ProjectStatus = 'idea' | 'work_in_progress' | 'to_deploy' | 'deployed' | 'updating';
export type StepStatus = 'todo' | 'done' | 'not_applicable';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  idea: 'Idea',
  work_in_progress: 'Work in progress',
  to_deploy: 'To deploy',
  deployed: 'Deployed',
  updating: 'In aggiornamento',
};

export interface Progress { done: number; applicable: number; percent: number | null }

/** Gli step "Non da fare" escono dal denominatore. Senza step applicabili: stato neutro (null). */
export function computeProgress(steps: { status: StepStatus }[]): Progress {
  const applicable = steps.filter(s => s.status !== 'not_applicable');
  const done = applicable.filter(s => s.status === 'done').length;
  return {
    done,
    applicable: applicable.length,
    percent: applicable.length === 0 ? null : Math.round((done / applicable.length) * 1000) / 10,
  };
}

export interface PatchNotes { changes: string; improvements?: string; fixes?: string; extra?: string }

export interface PublishGateInput {
  status: ProjectStatus;
  patch: PatchNotes;
  draftSaved: boolean;      // true solo dopo conferma del server
  hasNetlifyLink: boolean;  // link a Netlify tra i link del progetto
}

/**
 * AppPilot non pubblica nulla: abilita solo il promemoria "vai su Netlify e poi conferma".
 * `reason` spiega cosa manca quando è disabilitato.
 */
export function publishGate(i: PublishGateInput): { enabled: boolean; reason?: string } {
  if (i.status !== 'updating' && i.status !== 'to_deploy') return { enabled: false, reason: 'Il progetto deve essere To deploy o In aggiornamento.' };
  if (!i.patch.changes.trim()) return { enabled: false, reason: 'Descrivi le modifiche e salva le patch notes per procedere.' };
  if (!i.draftSaved) return { enabled: false, reason: 'Salva le patch notes: la bozza non è ancora stata confermata dal server.' };
  if (!i.hasNetlifyLink) return { enabled: false, reason: 'Aggiungi il link a Netlify tra i Link utili.' };
  return { enabled: true };
}
