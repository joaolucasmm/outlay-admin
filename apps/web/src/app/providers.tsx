import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import type { AppStore } from './store';

export function Providers({ store, children }: { store: AppStore; children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
