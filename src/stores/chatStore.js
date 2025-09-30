import { writable } from 'svelte/store';

export const chatStore = writable({
  messages: [],
  typing: false
});

