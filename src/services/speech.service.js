let recognizer = null;

export function initSpeech({ onStart, onResult, onError, onEnd } = {}){
  try{
    if (typeof window !== 'undefined' && window.createSpeechRecognition){
      recognizer = window.createSpeechRecognition({
        onStart: onStart || (()=>{}),
        onResult: onResult || (()=>{}),
        onError: onError || (()=>{}),
        onEnd: onEnd || (()=>{})
      });
      return true;
    }
  }catch{}
  return false;
}

export function isRecording(){
  try{ return recognizer?.isRecording() || false; }catch{ return false; }
}

export function startRecording(){ try{ recognizer?.start(); }catch{} }
export function stopRecording(){ try{ recognizer?.stop(); }catch{} }
