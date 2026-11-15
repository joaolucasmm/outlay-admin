import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_TENANT_ID } from './placeholderTenants';

/** Who is using the console (see CONTEXT.md). Not to be confused with an Employee Role. */
export type AdminRole = 'support_operator' | 'program_admin';

export const ADMIN_ROLE_OPTIONS: readonly { value: AdminRole; label: string }[] = [
  { value: 'support_operator', label: 'Support Operator' },
  { value: 'program_admin', label: 'Program Admin' },
];

export interface SessionState {
  currentRole: AdminRole;
  currentTenantId: string;
}

const initialState: SessionState = {
  currentRole: 'support_operator',
  currentTenantId: DEFAULT_TENANT_ID,
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setRole(state, action: PayloadAction<AdminRole>) {
      state.currentRole = action.payload;
    },
    setCurrentTenant(state, action: PayloadAction<string>) {
      state.currentTenantId = action.payload;
    },
  },
  selectors: {
    selectSession: (state) => state,
  },
});

export const { setRole, setCurrentTenant } = sessionSlice.actions;
export const { selectSession } = sessionSlice.selectors;
