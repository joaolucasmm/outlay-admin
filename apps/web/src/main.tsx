import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { apiMode } from './app/config';
import { Providers } from './app/providers';
import { router } from './app/router';
import { makeStore } from './app/store';
import { loadSession, saveSession } from './features/session/persistence';
import './index.css';

async function enableMocking() {
  if (apiMode !== 'mock') return;
  const { startMockWorker } = await import('./mocks/browser');
  await startMockWorker();
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

const savedSession = loadSession(localStorage);
const store = makeStore(savedSession ? { session: savedSession } : undefined);
store.subscribe(() => {
  saveSession(localStorage, store.getState().session);
});

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <Providers store={store}>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
