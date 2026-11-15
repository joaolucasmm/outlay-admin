import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Persona } from 'contracts';

/** The demo starts signed in as the Support Operator (see ADR 0002). */
export const DEFAULT_PERSONA: Persona = {
  id: 'per_operator',
  label: 'Support Operator',
  role: 'support_operator',
  tenantId: null,
};

export interface SessionState {
  persona: Persona;
  /** The Current Tenant: always the persona's own tenant for a Program Admin. */
  currentTenantId: string | null;
}

const initialState: SessionState = {
  persona: DEFAULT_PERSONA,
  currentTenantId: null,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    signIn(state, action: PayloadAction<Persona>) {
      state.persona = action.payload;
      state.currentTenantId = action.payload.tenantId ?? state.currentTenantId;
    },
    setCurrentTenant(state, action: PayloadAction<string>) {
      state.currentTenantId = action.payload;
    },
  },
  selectors: {
    selectSession: (state) => state,
    selectPersona: (state) => state.persona,
    selectRole: (state) => state.persona.role,
  },
});

export const { signIn, setCurrentTenant } = sessionSlice.actions;
export const { selectSession, selectPersona, selectRole } = sessionSlice.selectors;
