import { writable } from 'svelte/store';

export const captureStore = writable({
  type: 'image',
  region: 'rect',
  pending: null
});

