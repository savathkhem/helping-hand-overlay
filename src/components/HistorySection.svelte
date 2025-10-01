<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let items = [];
  export let page = 1;
  export let pages = 1;

  function select(item){
    dispatch('select', { id: item.id, item });
  }
</script>

<div class="hh-section">
  <div class="hh-header">
    <h3>Chat History</h3>
    <button class="hh-expander" aria-expanded="true">⌄</button>
  </div>
  <div class="hh-history-wrap">
    <div class="hh-history-grid">
      {#each items as item}
        <div class="hh-history-pill" on:click={() => select(item)} tabindex="0" role="button" aria-label={`Open ${item.title || 'capture'}`}>
          <div class="title">{item.title}</div>
          <div class="meta">{item.count || 0} msgs</div>
        </div>
      {/each}
    </div>
    <div class="hh-history-pager" style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:8px;">
      <button class="pager-btn">Prev</button>
      <span class="pager-info">Page {page} of {pages}</span>
      <button class="pager-btn">Next</button>
    </div>
  </div>
</div>
