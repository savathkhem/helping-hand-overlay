import { getSettings } from './settings.service.js';

async function callGeminiApi(apiKey, model, version, requestBody){
  const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  if (!res.ok){
    const txt = await res.text();
    let msg = txt;
    try{ msg = JSON.parse(txt)?.error?.message || txt; }catch{}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  const responseText = await res.text();
  try{
    const data = JSON.parse(responseText);
    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts?.length){
      return candidate.content.parts.map(p=> (typeof p.text==='string'?p.text:'')).filter(Boolean).join('\n').trim() || 'No response text returned.';
    }
  }catch{
    return responseText || 'No response text returned.';
  }
  return 'No response text returned.';
}

export async function sendPrompt({ text, imageBase64, imageMimeType = 'image/png' }){
  const settings = await getSettings();
  const prov = settings.providers?.gemini || {};
  const apiKey = prov.apiKey?.trim();
  const model = prov.defaultModel || 'gemini-2.5-flash';
  const version = prov.apiVersion || 'v1';
  if (!apiKey){
    throw new Error('Missing Gemini API key. Set it in Settings.');
  }
  const parts = [{ text }];
  if (imageBase64){
    parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
  }
  const requestBody = { contents: [{ role: 'user', parts }] };
  const textOut = await callGeminiApi(apiKey, model, version, requestBody);
  return { role: 'bot', text: textOut, ts: Date.now() };
}
