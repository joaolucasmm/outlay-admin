import type { AuditEventPage, ListAuditEventsQuery } from 'contracts';
import { api } from '../../app/api';

export type AuditLogArgs = Omit<ListAuditEventsQuery, 'cursor'>;

const auditApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** A single page, e.g. the "Recent activity" panel. */
    getAuditEvents: build.query<AuditEventPage, ListAuditEventsQuery>({
      query: (params) => ({ url: 'audit-events', params }),
      providesTags: ['Audit'],
    }),

    /** The filtered audit log, page after page. */
    getAuditLog: build.infiniteQuery<AuditEventPage, AuditLogArgs, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
      query: ({ queryArg, pageParam }) => ({
        url: 'audit-events',
        params: { ...queryArg, cursor: pageParam ?? undefined },
      }),
      providesTags: ['Audit'],
    }),
  }),
});

export const { useGetAuditEventsQuery, useGetAuditLogInfiniteQuery } = auditApi;
