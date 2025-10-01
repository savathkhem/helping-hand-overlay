<script>
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();
  export let collapsed = false;
  let type = 'image';
  let region = 'rect';
  let menuOpen = false;
  let menuEl;
  let menuBtnEl;

  function emit(){ dispatch('capture', { type, region }); }
  function setType(v){ type = v; }
  function setRegion(v){ region = v; }
  function toggleCollapse(){ dispatch('toggleCollapse'); }
  function toggleMenu(){ menuOpen = !menuOpen; }
  function onSettings(){
    dispatch('openSettings');
    menuOpen = false;
  }
  function onClose(){
    dispatch('close');
    menuOpen = false;
  }

  onMount(() => {
    const onDocClick = (e) => {
      if (!menuOpen) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (menuEl && !path.includes(menuEl) && menuBtnEl && !path.includes(menuBtnEl)) {
        menuOpen = false;
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') menuOpen = false;
    };
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
  });
</script>

<div class="hh-modal-toolbar" role="toolbar">
  <div class="hh-toolbar-left">
    <div class="hh-overlay-group" aria-label="Capture type">
      <button class="hh-overlay-btn {type==='image' ? 'active' : ''}" aria-pressed={type==='image'} on:click={() => setType('image')}>Image</button>
      <button class="hh-overlay-btn {type==='video' ? 'active' : ''}" aria-pressed={type==='video'} on:click={() => setType('video')}>Video</button>
    </div>
    <div class="hh-overlay-group" aria-label="Region mode">
      <button class="hh-overlay-btn {region==='rect' ? 'active' : ''}" aria-pressed={region==='rect'} on:click={() => setRegion('rect')}>Rect</button>
      <button class="hh-overlay-btn {region==='free' ? 'active' : ''}" aria-pressed={region==='free'} on:click={() => setRegion('free')}>Free</button>
    </div>
  </div>
  <div class="hh-toolbar-right">
    <button class="hh-capture-btn" on:click={emit}>Capture</button>
    <button class="hh-expander {collapsed ? 'rot-180' : ''}" aria-expanded={!collapsed} title="Expand/Collapse" on:click={toggleCollapse}>⌄</button>
    <div class="hh-toolbar-menu" style="position:relative;">
      <button bind:this={menuBtnEl} class="hh-expander" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="hhMenuDropdown" title="Menu" on:click={toggleMenu}>⋯</button>
      {#if menuOpen}
        <div bind:this={menuEl} id="hhMenuDropdown" class="hh-menu-dropdown" role="menu" style="right:0;">
          <button role="menuitem" on:click={onSettings}>Settings</button>
          <button role="menuitem" on:click={toggleCollapse}>{collapsed ? 'Expand' : 'Minimize'}</button>
          <button role="menuitem" on:click={onClose}>Close</button>
        </div>
      {/if}
    </div>
  </div>
</div>
