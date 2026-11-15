import type { Actor, Persona, Problem } from 'contracts';
import { HttpResponse } from 'msw';
import type { Db } from './db';

export const PERSONA_HEADER = 'X-Demo-Persona';
export const OPERATOR_PERSONA_ID = 'per_operator';
export const adminPersonaId = (tenantId: string) => `per_admin_${tenantId}`;

/** The Support Operator plus one Program Admin per tenant that can still sign in. */
export const personasFrom = (db: Db): Persona[] => [
  { id: OPERATOR_PERSONA_ID, label: 'Support Operator', role: 'support_operator', tenantId: null },
  ...db
    .tenants()
    .filter((tenant) => tenant.status !== 'deprovisioned')
    .map((tenant) => ({
      id: adminPersonaId(tenant.id),
      label: `Program Admin · ${tenant.name}`,
      role: 'program_admin' as const,
      tenantId: tenant.id,
    })),
];

export interface Caller {
  actor: Actor;
  tenantId: string | null;
}

/** Resolves the `X-Demo-Persona` header to the calling actor, or `null`. */
export const callerFrom = (request: Request, db: Db): Caller | null => {
  const id = request.headers.get(PERSONA_HEADER);
  const persona = personasFrom(db).find((p) => p.id === id);
  return persona
    ? { actor: { id: persona.id, role: persona.role }, tenantId: persona.tenantId }
    : null;
};

export const problem = (
  status: number,
  title: string,
  detail?: string,
  errors?: Problem['errors'],
) =>
  HttpResponse.json<Problem>(
    {
      type: `https://outlay.example/problems/${title.toLowerCase().replaceAll(' ', '-')}`,
      title,
      status,
      ...(detail ? { detail } : {}),
      ...(errors ? { errors } : {}),
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

export const unauthenticated = () =>
  problem(401, 'Unauthenticated', `Send a valid ${PERSONA_HEADER} header.`);

/** Cursor pagination over an in-memory list. The cursor is an opaque offset. */
export function paginate<T>(items: T[], url: URL) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 100);
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? Number(atob(cursor)) : 0;
  if (!Number.isInteger(offset) || offset < 0) return null;
  const end = offset + limit;
  return {
    items: items.slice(offset, end),
    nextCursor: end < items.length ? btoa(String(end)) : null,
  };
}
