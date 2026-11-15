/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` (default) starts MSW in the browser; `live` talks to a real backend. */
  readonly VITE_API_MODE?: 'mock' | 'live';
  readonly VITE_AI_MODE?: 'mock' | 'live';
  readonly VITE_AI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
