export async function startSelection(){
  try{
    await chrome.runtime.sendMessage({ type: 'hh-start-selection' });
    return true;
  }catch(e){
    console.warn('[HHO] startSelection failed', e);
    return false;
  }
}

export async function captureScreenshot() { return { dataUrl: '', selection: null }; }
export async function captureVideo() { return { blob: null, durationMs: 0 }; }
