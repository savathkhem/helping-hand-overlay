import { writable } from 'svelte/store';

export const uiStore = writable({
  surface: 'popup',
  collapsed: false,
  menuOpen: false,
  modal: { left: 200, top: 80, width: 760, height: 520 }
});

