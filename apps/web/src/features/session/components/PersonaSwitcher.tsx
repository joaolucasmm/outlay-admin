import type { Persona } from 'contracts';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../../app/api';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { Select } from '../../../shared/ui/Select';
import { useGetPersonasQuery } from '../api';
import { homePathFor } from '../navigation';
import { DEFAULT_PERSONA, selectPersona, signIn } from '../sessionSlice';

/** Demo-only "sign in as" control (ADR 0002). */
export function PersonaSwitcher() {
  const persona = useAppSelector(selectPersona);
  const { data: personas, isLoading } = useGetPersonasQuery(undefined);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const switchTo = (next: Persona) => {
    dispatch(signIn(next));
    // Each persona sees different data: drop everything cached for the previous one.
    dispatch(api.util.resetApiState());
    void navigate(homePathFor(next));
  };

  // A saved persona disappears when its tenant is deprovisioned or the demo is reset.
  const stale = personas !== undefined && !personas.some((p) => p.id === persona.id);
  useEffect(() => {
    if (stale) switchTo(DEFAULT_PERSONA);
    // switchTo is recreated every render; `stale` is the only trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  const options = (stale || !personas ? [persona, ...(personas ?? [])] : personas).map((p) => ({
    value: p.id,
    label: p.label,
  }));

  return (
    <Select
      label="Signed in as"
      value={persona.id}
      disabled={isLoading}
      options={options}
      onChange={(id) => {
        const next = personas?.find((p) => p.id === id);
        if (next) switchTo(next);
      }}
    />
  );
}
