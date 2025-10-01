<script>
  import Toolbar from './Toolbar.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let title = 'Helping Hand';
  // variant: 'modal' renders a card-like modal; 'panel' renders full-bleed content
  export let variant = 'modal';
</script>

{#if variant === 'modal'}
  <div class="hh-modal" id="hhModal">
    <Toolbar on:capture={() => dispatch('capture')} />
    <div class="hh-modal-body">
      <div class="hh-body-inner">
        <slot />
      </div>
    </div>
  </div>
{:else}
  <div class="hh-panel" id="hhPanel">
    <Toolbar on:capture={() => dispatch('capture')} />
    <div class="hh-panel-body">
      <div class="hh-body-inner">
        <slot />
      </div>
    </div>
  </div>
{/if}
