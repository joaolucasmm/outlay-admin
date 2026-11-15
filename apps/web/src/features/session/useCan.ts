import { can, type Permission } from '@outlay/domain';
import { useAppSelector } from '../../app/store';
import { selectRole } from './sessionSlice';

/** `can(permission)` for the signed-in persona. Same table the mock backend enforces. */
export function useCan() {
  const role = useAppSelector(selectRole);
  return (permission: Permission) => can(role, permission);
}
