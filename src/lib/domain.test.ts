import { describe, it, expect } from 'vitest';
import { computeProgress, publishGate } from './domain';

const ok = { status: 'updating' as const, patch: { changes: 'Nuova traduzione' }, draftSaved: true, hasNetlifyLink: true };

describe('progresso', () => {
  it('esclude "Non da fare" dal denominatore (6/9 = 66,7%)', () => {
    const steps = [...Array(6).fill({ status: 'done' }), ...Array(3).fill({ status: 'todo' }), { status: 'not_applicable' }];
    expect(computeProgress(steps)).toEqual({ done: 6, applicable: 9, percent: 66.7 });
  });
  it('stato neutro senza step applicabili', () => {
    expect(computeProgress([{ status: 'not_applicable' }]).percent).toBeNull();
  });
});

describe('promemoria di pubblicazione', () => {
  it('abilitato con tutte le condizioni', () => expect(publishGate(ok).enabled).toBe(true));
  it('abilitato anche per To deploy', () => expect(publishGate({ ...ok, status: 'to_deploy' }).enabled).toBe(true));
  it('disabilitato se Deployed o Idea', () => {
    expect(publishGate({ ...ok, status: 'deployed' }).enabled).toBe(false);
    expect(publishGate({ ...ok, status: 'idea' }).enabled).toBe(false);
  });
  it('disabilitato senza note', () => expect(publishGate({ ...ok, patch: { changes: '  ' } }).reason).toMatch(/Descrivi le modifiche/));
  it('disabilitato se la bozza non è confermata dal server', () => expect(publishGate({ ...ok, draftSaved: false }).enabled).toBe(false));
  it('disabilitato senza link Netlify', () => expect(publishGate({ ...ok, hasNetlifyLink: false }).enabled).toBe(false));
});
