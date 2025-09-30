<script>
  import ModalShell from './components/ModalShell.svelte';
  import ChatWindow from './components/ChatWindow.svelte';
  import PromptPill from './components/PromptPill.svelte';
  import HistorySection from './components/HistorySection.svelte';
  import './styles/variables.css';
  import './styles/base.css';

  const demoHistory = [
    { id: 'h1', title: 'Overlay toolbar UI', count: 2 },
    { id: 'h2', title: 'Capture mapping', count: 2 },
    { id: 'h3', title: 'Add dropdown menu', count: 2 },
    { id: 'h4', title: 'Slide animation', count: 2 }
  ];
  const demoMessages = [
    { role: 'bot', text: "Here's a modal with toolbar controls and a bubble minimizer.", ts: Date.now()-60000 },
    { role: 'me', text: 'Cool — show me a draggable overlay with a toolbar-first layout.', ts: Date.now()-30000 }
  ];
</script>

<ModalShell>
  <div class="hh-section" id="hhChatSection">
    <div class="hh-header"><h3>Chat</h3></div>
    <ChatWindow {demoMessages} messages={demoMessages} />
  </div>

  <div class="hh-section" id="hhPromptsSection">
    <div class="hh-header"><h3>Prompts</h3></div>
    <PromptPill />
  </div>

  <HistorySection items={demoHistory} page={1} pages={1} />
</ModalShell>
