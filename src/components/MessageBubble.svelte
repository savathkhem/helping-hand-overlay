<script>
  export let role = 'bot';
  export let text = '';
  export let ts = Date.now();
</script>

<div class="hh-msg {role === 'me' ? 'me' : 'bot'}">
  <div class="stack">
    <div class="bubble">{text}</div>
    <div class="meta"><span class="hh-time">{new Date(ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span></div>
  </div>
  <slot />
</div>

