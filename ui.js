function createUI() {
  return `
    <header class="header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div>
        <h1 class="title" style="margin:0;">Helping Hand</h1>
        <p class="subtitle" style="margin:0;">Capture > Ask > Understand</p>
      </div>
      <div>
        <button id="openPanelBtn" title="Open side panel" style="background:#e2e8f0;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;">Open Panel</button>
        <button id="headerSettingsCog" title="Settings" style="background:none;border:none;font-size:18px;cursor:pointer;">Settings</button>
      </div>
    </header>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Screenshot</h2>
        <button id="captureBtn" class="primary">Capture Screenshot</button>
      </div>
      <div class="preview" id="screenshotPreview">
        <img id="screenshotImg" alt="Screenshot preview" />
        <p class="placeholder" id="screenshotPlaceholder">No screenshot captured yet.</p>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Voice Prompt</h2>
        <span id="status" class="status">Click to record your question</span>
      </div>
      <div class="input-row">
        <button id="recordBtn" class="secondary">Start Recording</button>
        <div class="spinner" id="recordingSpinner" hidden></div>
      </div>
      <textarea id="promptText" rows="4" placeholder="Your transcribed question will appear here..."></textarea>
      <div class="history" id="transcriptHistory" hidden>
        <h3>Recent activity</h3>
        <ul id="historyList"></ul>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Ask For Help</h2>
      </div>
      <div class="actions">
        <button id="submitBtn" class="primary">Get Help</button>
        <div class="spinner" id="submitSpinner" hidden></div>
      </div>
      <div id="responseContainer" class="response" aria-live="polite"></div>
    </section>
  `;
}

window.createUI = createUI;

