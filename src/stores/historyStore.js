import { writable } from 'svelte/store';

export const historyStore = writable({
  items: [],
  page: 1,
  pageSize: 8,
  total: 0
});

