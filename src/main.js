import App from './App.svelte';

const target =
  document.getElementById('popupContainer') ||
  document.getElementById('sidePanelContainer') ||
  document.body;

const app = new App({ target });

export default app;

