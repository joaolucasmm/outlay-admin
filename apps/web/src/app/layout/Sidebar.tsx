import { NavLink } from 'react-router';
import { useAppSelector } from '../store';
import { ResetDemoButton } from '../../features/session/components/ResetDemoButton';
import { navItemsFor } from '../../features/session/navigation';
import { selectSession } from '../../features/session/sessionSlice';

export function Sidebar() {
  const { persona, currentTenantId } = useAppSelector(selectSession);
  const items = navItemsFor(persona, currentTenantId);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-4 text-lg font-semibold tracking-tight">Outlay Admin</div>
      <nav aria-label="Main" className="flex-1">
        <ul className="space-y-1 px-3">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isActive
                      ? 'bg-indigo-50 font-medium text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-200 p-3">
        <ResetDemoButton />
      </div>
    </aside>
  );
}
