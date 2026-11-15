import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { apiMode } from './app/config';
import { Providers } from './app/providers';
import { router } from './app/router';
import { makeStore } from './app/store';
import { loadOnboardingDraft, saveOnboardingDraft } from './features/onboarding/persistence';
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
const savedDraft = loadOnboardingDraft(localStorage);
const store = makeStore({
  ...(savedSession ? { session: savedSession } : {}),
  ...(savedDraft ? { onboarding: savedDraft } : {}),
});

// Persist the client state that must survive a reload (never server data).
let persisted = store.getState();
store.subscribe(() => {
  const state = store.getState();
  if (state.session !== persisted.session) saveSession(localStorage, state.session);
  if (state.onboarding !== persisted.onboarding) {
    saveOnboardingDraft(localStorage, state.onboarding);
  }
  persisted = state;
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
