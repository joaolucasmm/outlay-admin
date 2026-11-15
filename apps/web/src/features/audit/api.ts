import type { AuditEventPage, ListAuditEventsQuery } from 'contracts';
import { api } from '../../app/api';

const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAuditEvents: build.query<AuditEventPage, ListAuditEventsQuery>({
      query: (params) => ({ url: 'audit-events', params }),
      providesTags: ['Audit'],
    }),
  }),
});

export const { useGetAuditEventsQuery } = auditApi;
