<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  let type = 'image';
  let region = 'rect';
  function emit(){ dispatch('capture', { type, region }); }
  function setType(v){ type = v; }
  function setRegion(v){ region = v; }
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
    <button class="hh-expander" aria-expanded="true">⌄</button>
    <button class="hh-expander" aria-label="Menu">⋯</button>
  </div>
</div>
