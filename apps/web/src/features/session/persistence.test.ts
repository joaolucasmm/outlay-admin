import { beforeEach, describe, expect, it } from 'vitest';
import { adminOf } from '../../test/personas';
import { loadSession, saveSession } from './persistence';

describe('session persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips the session', () => {
    const session = { persona: adminOf('tnt_bluefin'), currentTenantId: 'tnt_bluefin' };
    saveSession(localStorage, session);
    expect(loadSession(localStorage)).toEqual(session);
  });

  it('ignores missing or malformed data', () => {
    expect(loadSession(localStorage)).toBeUndefined();
    localStorage.setItem('outlay-admin:session:v1', '{not json');
    expect(loadSession(localStorage)).toBeUndefined();
    localStorage.setItem('outlay-admin:session:v1', JSON.stringify({ persona: null }));
    expect(loadSession(localStorage)).toBeUndefined();
  });
});
