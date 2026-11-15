import { NavLink } from 'react-router';
import { useAppSelector } from '../store';
import { navItemsFor } from '../../features/session/navigation';
import { selectSession } from '../../features/session/sessionSlice';

export function Sidebar() {
  const { currentRole, currentTenantId } = useAppSelector(selectSession);
  const items = navItemsFor(currentRole, currentTenantId);

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
      <div className="px-5 py-4 text-lg font-semibold tracking-tight">Outlay Admin</div>
      <nav aria-label="Main">
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
    </aside>
  );
}
