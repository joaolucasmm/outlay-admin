import type { Permission } from '@outlay/domain';
import type { ReactNode } from 'react';
import { useCan } from '../useCan';
import { NotAuthorized } from './NotAuthorized';

/** Route guard: renders `children` only if the persona has `permission`. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const can = useCan();
  return can(permission) ? (
    children
  ) : (
    <NotAuthorized reason={`This page needs the "${permission}" permission.`} />
  );
}
