import { RoleSwitcher } from '../../features/session/components/RoleSwitcher';
import { TenantSwitcher } from '../../features/session/components/TenantSwitcher';
import { ApiStatus } from '../../features/system/ApiStatus';

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <ApiStatus />
      <div className="flex flex-wrap items-center gap-4">
        <TenantSwitcher />
        <RoleSwitcher />
      </div>
    </header>
  );
}
