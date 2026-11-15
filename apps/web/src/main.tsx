import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { apiMode } from './app/config';
import { Providers } from './app/providers';
import { router } from './app/router';
import { makeStore } from './app/store';
import './index.css';

async function enableMocking() {
  if (apiMode !== 'mock') return;
  const { startMockWorker } = await import('./mocks/browser');
  await startMockWorker();
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <Providers store={makeStore()}>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
