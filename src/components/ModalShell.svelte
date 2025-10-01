<script>
  import Toolbar from './Toolbar.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let title = 'Helping Hand';
  // variant: 'modal' renders a card-like modal; 'panel' renders full-bleed content
  export let variant = 'modal';
  export let collapsed = false;
</script>

{#if variant === 'modal'}
  <div class="hh-modal" id="hhModal">
    <Toolbar {collapsed} on:capture={() => dispatch('capture')} on:toggleCollapse={() => dispatch('toggleCollapse')} on:openSettings={() => dispatch('openSettings')} on:close={() => dispatch('close')} />
    <div class="hh-modal-body {collapsed ? 'collapsed' : ''}">
      <div class="hh-body-inner">
        <slot />
      </div>
    </div>
  </div>
{:else}
  <div class="hh-panel" id="hhPanel">
    <Toolbar {collapsed} on:capture={() => dispatch('capture')} on:toggleCollapse={() => dispatch('toggleCollapse')} on:openSettings={() => dispatch('openSettings')} on:close={() => dispatch('close')} />
    <div class="hh-panel-body {collapsed ? 'collapsed' : ''}">
      <div class="hh-body-inner">
        <slot />
      </div>
    </div>
  </div>
{/if}
