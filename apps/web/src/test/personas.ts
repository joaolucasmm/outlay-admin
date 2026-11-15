import type { Persona } from 'contracts';
import type { RootState } from '../app/store';
import { DEFAULT_PERSONA } from '../features/session/sessionSlice';

export const operator = DEFAULT_PERSONA;

export const adminOf = (tenantId: string, name = tenantId): Persona => ({
  id: `per_admin_${tenantId}`,
  label: `Program Admin · ${name}`,
  role: 'program_admin',
  tenantId,
});

/** Preloaded state for `renderApp`, signed in as `persona`. */
export const signedInAs = (persona: Persona): Partial<RootState> => ({
  session: { persona, currentTenantId: persona.tenantId },
});
