import App from './App.svelte';

const target =
  document.getElementById('popupContainer') ||
  document.getElementById('sidePanelContainer') ||
  document.body;

const params = new URLSearchParams(location.search);
const surface = params.get('surface') || (document.getElementById('sidePanelContainer') ? 'sidepanel' : 'popup');

const app = new App({ target, props: { surface } });

export default app;
