import { describe, it, expect } from 'vitest';
import { safeHttps } from './detail';

describe('validazione URL', () => {
  it('accetta solo https', () => {
    expect(safeHttps('https://esempio.it/a')).toBe('https://esempio.it/a');
    expect(safeHttps('http://esempio.it')).toBeNull();
    expect(safeHttps('javascript:alert(1)')).toBeNull();
    expect(safeHttps('non un url')).toBeNull();
  });
});
