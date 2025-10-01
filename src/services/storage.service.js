let captureStore = null;

export async function init() {
  try {
    if (!captureStore && typeof window !== 'undefined' && window.CaptureStorage) {
      captureStore = new window.CaptureStorage();
      await captureStore.init();
    }
  } catch (err) {
    console.warn('[HHO] storage.service init failed', err);
  }
}

export async function listRecentCaptures(limit = 10) {
  try {
    if (!captureStore) await init();
    if (!captureStore) return [];
    const items = await captureStore.listRecentCaptures(limit);
    return items;
  } catch (err) {
    console.warn('[HHO] listRecentCaptures failed', err);
    return [];
  }
}

export async function saveCapture(capture) {
  try {
    if (!captureStore) await init();
    if (!captureStore) return capture;
    return await captureStore.upsertCapture(capture);
  } catch (err) {
    console.warn('[HHO] saveCapture failed', err);
    return capture;
  }
}

export async function updateCapture(id, updates = {}){
  try{
    if (!captureStore) await init();
    if (!captureStore) return null;
    return await captureStore.updateCapture(id, updates);
  }catch(err){
    console.warn('[HHO] updateCapture failed', err);
    return null;
  }
}

export async function saveBlob(captureId, kind, blob){
  try{
    if (!captureStore) await init();
    if (!captureStore) return null;
    return await captureStore.saveBlob(captureId, kind, blob);
  }catch(err){
    console.warn('[HHO] saveBlob failed', err); return null;
  }
}

export async function getBlob(captureId, kind){
  try{
    if (!captureStore) await init();
    if (!captureStore) return null;
    return await captureStore.getBlob(captureId, kind);
  }catch(err){
    console.warn('[HHO] getBlob failed', err); return null;
  }
}
