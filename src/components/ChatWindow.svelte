<script>
  export let messages = [];
</script>

<div class="hh-chat" aria-live="polite">
  {#if !messages || messages.length === 0}
    <div class="hh-history-pill">No messages yet</div>
  {:else}
    {#each [...messages].reverse() as msg}
      <div class="hh-msg {msg.role === 'me' ? 'me' : 'bot'}">
        <div class="stack">
          <div class="bubble">{msg.text}</div>
          <div class="meta"><span class="hh-time">{new Date(msg.ts||Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span></div>
        </div>
      </div>
    {/each}
  {/if}
</div>

