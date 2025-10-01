<script>
  import { createEventDispatcher } from 'svelte';
  export let placeholder = 'Ask anything';
  export let value = '';
  export let disabled = false;
  export let recording = false;
  const dispatch = createEventDispatcher();

  function submit(){
    const text = value?.trim();
    if (!text) return;
    dispatch('submit', { text });
  }
  function onKey(e){
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  }
  function onInput(e){ value = e.target.value; }
</script>

<div class="hh-prompt-pill">
  <button class="icon-btn" title="Add" aria-label="Add" disabled={disabled}>+</button>
  <input class="hh-pill-input" placeholder={placeholder} bind:value on:keydown={onKey} on:input={onInput} disabled={disabled} />
  <button class="icon-btn {recording ? 'toggled' : ''}" title="Voice" aria-label="Voice" aria-pressed={recording} on:click={() => dispatch('mic')} disabled={disabled}>🎤</button>
  <button class="icon-btn" title="Send" aria-label="Send" on:click={submit} disabled={disabled}>✨</button>
</div>
<div class="hh-muted" style="margin-top:8px">Tip: press <strong>Enter</strong> to add a prompt to the chat.</div>
