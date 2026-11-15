import { PersonaSwitcher } from '../../features/session/components/PersonaSwitcher';
import { ViewingTenantSwitcher } from '../../features/session/components/ViewingTenantSwitcher';
import { ApiStatus } from '../../features/system/ApiStatus';

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <ApiStatus />
      <div className="flex flex-wrap items-center gap-4">
        <ViewingTenantSwitcher />
        <PersonaSwitcher />
      </div>
    </header>
  );
}
