import type { Persona } from 'contracts';
import { http, HttpResponse } from 'msw';
import { db } from '../db';
import { personasFrom } from '../http';

export const demoHandlers = [
  http.get('*/api/v1/demo/personas', () => HttpResponse.json<Persona[]>(personasFrom(db))),

  http.post('*/api/v1/demo/reset', () => {
    db.reset();
    return new HttpResponse(null, { status: 204 });
  }),
];
