import type { components, paths } from './generated/schema';

export type { components, paths };

export type Schemas = components['schemas'];
export type Health = Schemas['Health'];
