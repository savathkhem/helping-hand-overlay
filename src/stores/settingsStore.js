import { writable } from 'svelte/store';

export const settingsStore = writable({
  uiVariant: 'svelte',
  activeProvider: 'gemini',
  providers: {}
});

