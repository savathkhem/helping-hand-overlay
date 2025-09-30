export async function sendPrompt({ text, attachments = [] }) {
  return { role: 'bot', text: 'Mock response', ts: Date.now() };
}

