<script>
  import ModalShell from './components/ModalShell.svelte';
  import ChatWindow from './components/ChatWindow.svelte';
  import PromptPill from './components/PromptPill.svelte';
  import HistorySection from './components/HistorySection.svelte';
  import './styles/variables.css';
  import './styles/base.css';
  import { onMount } from 'svelte';
  import { init as initStorage, listRecentCaptures, saveCapture, saveBlob, updateCapture, getBlob } from './services/storage.service.js';
  import { sendPrompt as sendModelPrompt } from './services/model.service.js';
  import { startSelection } from './services/capture.service.js';
  import { initSpeech, startRecording as startMic, stopRecording as stopMic, isRecording as micActive } from './services/speech.service.js';

  export let surface = 'popup';
  let historyItems = [];
  let selected = null;
  let messages = [];
  let recentsCache = [];
  let prompt = '';
  let sending = false;
  let isSelecting = false;
  let previewImage = '';
  let videoUrl = '';
  let isRecordingVideo = false;
  let isVideoProcessing = false;
  let lastObjectUrl = '';
  let micRecording = false;

  function revokeObjectUrl(){
    if (lastObjectUrl){
      try { URL.revokeObjectURL(lastObjectUrl); } catch {}
      lastObjectUrl = '';
    }
  }

  function refreshHistoryList(){
    historyItems = recentsCache.slice(0,10).map(r => ({
      id: r.id,
      title: r.prompt?.slice(0,48) || new Date(r.updatedAt||Date.now()).toLocaleString(),
      count: (r.response ? 2 : (r.prompt ? 1 : 0))
    }));
  }

  function deriveMessages(cap){
    if (!cap) return [];
    const msgs = [];
    if (cap.prompt) msgs.push({ role: 'me', text: cap.prompt, ts: cap.createdAt || Date.now() });
    if (cap.response) msgs.push({ role: 'bot', text: cap.response, ts: cap.updatedAt || Date.now() });
    return msgs;
  }

  onMount(async () => {
    await initStorage();
    const recents = await listRecentCaptures(10);
    recentsCache = recents;
    // map to simple items for history list
    historyItems = recents.map(r => ({
      id: r.id,
      title: r.prompt?.slice(0, 48) || new Date(r.updatedAt||Date.now()).toLocaleString(),
      count: (r.response ? 2 : (r.prompt ? 1 : 0))
    }));
    if (recents.length){
      selected = recents[0];
      messages = deriveMessages(selected);
    }

    // consume any pending capture left by background
    try{
      const KEY = 'hh-pending-capture';
      chrome.storage.local.get([KEY], async (res) => {
        const stored = res?.[KEY];
        if (stored && stored.screenshotDataUrl){
          await handleSelectionResult(stored);
          chrome.storage.local.remove(KEY, ()=>{});
        }
      });
    }catch{}

    // listen for background messages
    try{
      chrome.runtime.onMessage.addListener((message) => {
        if (!message || !message.type) return;
        if (message.type === 'hh-selection-result') {
          handleSelectionResult(message.payload);
        } else if (message.type === 'hh-selection-error') {
          isSelecting = false;
        } else if (message.type === 'hh-selection-cancelled') {
          isSelecting = false;
        } else if (message.type === 'hh-video-start') {
          startVideoRecording();
        } else if (message.type === 'hh-video-stop') {
          stopVideoRecording({ userInitiated: true });
        }
      });
    }catch{}

    // init speech
    initSpeech({
      onStart(){ micRecording = true; },
      onResult(displayText){ prompt = displayText || ''; },
      onError(){ micRecording = false; },
      onEnd(finalTranscript){ micRecording = false; if (finalTranscript) prompt = finalTranscript; }
    });
  });

  function handleSelect(e){
    const item = e.detail?.item;
    if (!item) return;
    const cap = recentsCache.find(x => x.id === item.id) || null;
    // fallback: re-query list and pick by id
    const pick = cap || null;
    if (pick){
      selected = pick;
      messages = deriveMessages(selected);
      // update preview
      revokeObjectUrl();
      previewImage = '';
      videoUrl = '';
      const hasVideo = !!selected.attachments?.video?.blobKey;
      const hasShot = !!selected.attachments?.screenshot?.blobKey;
      if (hasVideo){
        getBlob(selected.id, 'video').then((blob)=>{
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          lastObjectUrl = url; videoUrl = url;
        });
      } else if (hasShot){
        getBlob(selected.id, 'screenshot').then((blob)=>{
          if (!blob) { previewImage = selected.thumbnailDataUrl || ''; return; }
          const url = URL.createObjectURL(blob);
          lastObjectUrl = url; previewImage = url;
        });
      } else {
        previewImage = selected.thumbnailDataUrl || '';
      }
    }
  }

  async function handleSubmit(e){
    const text = e?.detail?.text || prompt?.trim();
    if (!text || sending) return;
    sending = true;
    const userMsg = { role: 'me', text, ts: Date.now() };
    messages = [...messages, userMsg];
    try{
      // encode screenshot (if any)
      let imageBase64 = '';
      if (selected?.attachments?.screenshot?.blobKey){
        const blob = await getBlob(selected.id, 'screenshot');
        if (blob){
          imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result||'').toString().split(',')[1]||'');
            reader.readAsDataURL(blob);
          });
        }
      }
      // mark selected capture pending or create one
      if (!selected){
        selected = await saveCapture({ prompt: text, status: 'pending' });
        recentsCache = [selected, ...recentsCache];
      } else {
        selected = (await updateCapture(selected.id, { prompt: text, status: 'pending' })) || selected;
        recentsCache = [selected, ...recentsCache.filter(c => c.id !== selected.id)];
      }
      refreshHistoryList();

      const bot = await sendModelPrompt({ text, imageBase64, imageMimeType: 'image/png' });
      messages = [...messages, bot];
      const updated = await updateCapture(selected.id, { response: bot.text, status: 'complete' });
      if (updated) selected = updated;
      recentsCache = [selected, ...recentsCache.filter(c => c.id !== selected.id)];
      refreshHistoryList();
    }catch(err){
      messages = [...messages, { role: 'bot', text: err?.message || 'Failed to send', ts: Date.now() }];
      if (selected){
        const failed = await updateCapture(selected.id, { status: 'error', error: (err?.message||'send-failed') });
        if (failed) selected = failed;
      }
    }finally{
      sending = false;
      prompt = '';
    }
  }

  async function onCapture(){
    if (isSelecting) return;
    isSelecting = true;
    try{ await startSelection(); }
    finally{ /* wait for message to reset */ }
  }

  function createThumbnail(dataUrl, targetWidth = 200, quality = 0.8){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try{
          const scale = targetWidth / img.naturalWidth;
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const thumb = canvas.toDataURL('image/jpeg', quality);
          resolve(thumb);
        }catch(err){ reject(err); }
      };
      img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
      img.src = dataUrl;
    });
  }

  function cropScreenshot(dataUrl, selection){
    return new Promise((resolve, reject) => {
      if (!selection) { resolve(dataUrl); return; }
      const img = new Image();
      img.onload = () => {
        try{
          const scaleX = img.naturalWidth / selection.viewportWidth;
          const scaleY = img.naturalHeight / selection.viewportHeight;
          const cropWidth = Math.max(1, Math.round(selection.width * scaleX));
          const cropHeight = Math.max(1, Math.round(selection.height * scaleY));
          const sourceX = Math.max(0, Math.round(selection.x * scaleX));
          const sourceY = Math.max(0, Math.round(selection.y * scaleY));
          const canvas = document.createElement('canvas');
          canvas.width = cropWidth; canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
          resolve(canvas.toDataURL('image/png'));
        }catch(err){ reject(err); }
      };
      img.onerror = () => reject(new Error('Failed to load screenshot for cropping.'));
      img.src = dataUrl;
    });
  }

  async function handleSelectionResult(payload){
    isSelecting = false;
    if (!payload || !payload.screenshotDataUrl) return;
    try{
      const cropped = payload.mode === 'region' ? await cropScreenshot(payload.screenshotDataUrl, payload.selection) : payload.screenshotDataUrl;
      const thumb = await createThumbnail(cropped);
      const saved = await saveCapture({
        prompt: '',
        thumbnailDataUrl: thumb,
        status: 'draft',
        selection: payload.selection,
        mode: payload.mode
      });
      // save full screenshot as blob and attach
      const blob = await (async()=>{
        const res = await fetch(cropped);
        return await res.blob();
      })();
      const blobKey = await saveBlob(saved.id, 'screenshot', blob);
      await updateCapture(saved.id, { attachments: { ...saved.attachments, screenshot: { blobKey, mimeType: blob.type || 'image/png', size: blob.size } } });

      previewImage = cropped; revokeObjectUrl();
      selected = saved;
      recentsCache = [saved, ...recentsCache];
      refreshHistoryList();
    }catch(err){
      console.warn('[HHO] handleSelectionResult failed', err);
    }
  }

  // --- Video recording (simplified port) ---
  const VIDEO_MIME_TYPE = 'video/webm';
  let mediaRecorder = null; let recordedChunks = []; let videoStream = null; let videoStart = 0;
  function captureTabStream(){
    return new Promise((resolve,reject)=>{
      try{
        chrome.tabCapture.capture({ audio:false, video:true, videoConstraints:{ mandatory:{ maxWidth:1280,maxHeight:720,maxFrameRate:30 } } }, (stream)=>{
          if (chrome.runtime.lastError || !stream){ reject(new Error(chrome.runtime.lastError?.message || 'Tab capture failed')); return; }
          resolve(stream);
        });
      }catch(err){ reject(err); }
    });
  }
  async function startVideoRecording(){
    if (isRecordingVideo) return; isRecordingVideo = true; videoStart = Date.now(); recordedChunks = [];
    try{
      videoStream = await captureTabStream();
      mediaRecorder = new MediaRecorder(videoStream, { mimeType: VIDEO_MIME_TYPE });
      mediaRecorder.ondataavailable = (e)=>{ if (e.data && e.data.size) recordedChunks.push(e.data); };
      mediaRecorder.onstop = async ()=>{ await processRecordedVideo(); };
      mediaRecorder.start();
    }catch(err){ isRecordingVideo = false; console.warn('[HHO] startVideoRecording failed', err); }
  }
  async function processRecordedVideo(){
    isVideoProcessing = true;
    try{
      const blob = new Blob(recordedChunks, { type: VIDEO_MIME_TYPE });
      recordedChunks = [];
      if (!blob.size) { isRecordingVideo=false; isVideoProcessing=false; return; }
      const url = URL.createObjectURL(blob); videoUrl = url;
      // generate simple thumbnail
      const thumb = await new Promise((resolve)=>{
        const v = document.createElement('video'); v.muted=true; v.src=url; v.currentTime=0;
        v.addEventListener('loadeddata',()=>{
          try{ const c=document.createElement('canvas'); const w=v.videoWidth||640,h=v.videoHeight||360; c.width=w; c.height=h; c.getContext('2d').drawImage(v,0,0,w,h); resolve(c.toDataURL('image/jpeg',0.75)); }
          catch{ resolve(''); }
        });
        v.addEventListener('error',()=>resolve(''));
      });
      const saved = await saveCapture({ prompt:'', status:'draft', thumbnailDataUrl: thumb||'' });
      const blobKey = await saveBlob(saved.id, 'video', blob);
      await updateCapture(saved.id, { attachments: { ...saved.attachments, video: { blobKey, mimeType: blob.type||VIDEO_MIME_TYPE, size: blob.size, durationMs: Math.max(1, Date.now()-videoStart), thumbnailDataUrl: thumb } } });
      recentsCache = [saved, ...recentsCache];
      historyItems = recentsCache.slice(0,10).map(r => ({ id:r.id, title:r.prompt?.slice(0,48)||new Date(r.updatedAt||Date.now()).toLocaleString(), count:(r.response?2:(r.prompt?1:0)) }));
      selected = saved;
    }finally{
      try{ videoStream?.getTracks()?.forEach(t=>t.stop()); }catch{}
      videoStream = null; mediaRecorder = null; isRecordingVideo=false; isVideoProcessing=false;
    }
  }
  function stopVideoRecording(){ try{ if (mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop(); }catch{} }
</script>

<ModalShell variant={surface === 'modal' ? 'panel' : 'modal'} on:capture={onCapture}>
  {#if surface === 'modal'}
  <div class="hh-section" id="hhPreviewSection">
    <div class="hh-header"><h3>Preview</h3></div>
    {#if previewImage}
      <img alt="Screenshot preview" src={previewImage} style="max-width:100%;border:1px solid var(--muted-2);border-radius:8px;" />
    {:else if videoUrl}
      <div>
        <video src={videoUrl} controls style="width:100%;border:1px solid var(--muted-2);border-radius:8px;"></video>
        {#if isRecordingVideo}
          <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
            <button class="hh-overlay-btn primary" on:click={stopVideoRecording}>Stop Recording</button>
            <span class="hh-muted">Recording…</span>
          </div>
        {/if}
      </div>
    {:else}
      <div class="hh-history-pill">No capture yet</div>
    {/if}
  </div>
  {/if}

  <div class="hh-section" id="hhChatSection">
    <div class="hh-header"><h3>Chat</h3></div>
    <ChatWindow {messages} />
  </div>

  <div class="hh-section" id="hhPromptsSection">
    <div class="hh-header"><h3>Prompts</h3></div>
    <PromptPill bind:value={prompt} recording={micRecording} disabled={sending} on:submit={handleSubmit} on:mic={() => (micActive() ? stopMic() : startMic())} />
  </div>

  <HistorySection items={historyItems} page={1} pages={1} on:select={handleSelect} />
</ModalShell>
