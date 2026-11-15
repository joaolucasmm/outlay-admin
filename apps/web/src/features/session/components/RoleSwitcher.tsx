import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { Select } from '../../../shared/ui/Select';
import { homePathFor } from '../navigation';
import { ADMIN_ROLE_OPTIONS, selectSession, setRole } from '../sessionSlice';

/** Demo-only control: switches the Admin Role of the session. */
export function RoleSwitcher() {
  const { currentRole, currentTenantId } = useAppSelector(selectSession);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <Select
      label="Role"
      value={currentRole}
      options={ADMIN_ROLE_OPTIONS}
      onChange={(role) => {
        dispatch(setRole(role));
        void navigate(homePathFor(role, currentTenantId));
      }}
    />
  );
}
