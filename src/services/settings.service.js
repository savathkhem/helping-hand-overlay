const SETTINGS_KEY = 'hh-settings';

const defaultSettings = {
  activeProvider: 'gemini',
  uiSurface: 'popup',
  providers: {
    gemini: {
      apiKey: '',
      defaultModel: 'gemini-2.5-flash',
      apiVersion: 'v1'
    }
  }
};

function storageGet(keys){
  return new Promise((resolve)=>{
    try{
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local){
        chrome.storage.local.get(keys, (res)=>resolve(res||{}));
      } else {
        resolve({});
      }
    }catch(e){ resolve({}); }
  });
}

export async function getSettings(){
  try{
    const res = await storageGet([SETTINGS_KEY]);
    const stored = res?.[SETTINGS_KEY] || {};
    // shallow merge for safety
    const merged = {
      ...defaultSettings,
      ...stored,
      providers: { gemini: { ...defaultSettings.providers.gemini, ...(stored.providers?.gemini||{}) } }
    };
    return merged;
  }catch(e){
    return defaultSettings;
  }
}

