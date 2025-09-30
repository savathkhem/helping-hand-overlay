<script>
  import Toolbar from './Toolbar.svelte';
  export let title = 'Helping Hand';
</script>

<div class="hh-modal" id="hhModal">
  <Toolbar />
  <div class="hh-modal-body">
    <div class="hh-body-inner">
      <slot />
    </div>
  </div>
</div>

