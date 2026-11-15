import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Providers } from '../app/providers';
import { routes } from '../app/routes';
import { makeStore, type RootState } from '../app/store';

/** Renders the whole app (store, routes, layout) at `path`, in memory. */
export function renderApp(path = '/', preloadedState?: Partial<RootState>) {
  const store = makeStore(preloadedState);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <Providers store={store}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, store, router };
}
