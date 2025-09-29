function createSpeechRecognition({
  onStart,
  onResult,
  onError,
  onEnd,
}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let isRecording = false;
  let finalTranscript = "";

  recognition.onstart = () => {
    isRecording = true;
    finalTranscript = "";
    onStart();
  };

  recognition.onresult = (event) => {
    const finalPhrases = [];
    const interimPhrases = [];
    let lastResult = null;

    for (const entry of event.results) {
      const transcript = entry[0].transcript.trim();
      if (!transcript) continue;

      lastResult = entry;
      if (entry.isFinal) finalPhrases.push(transcript);
      else interimPhrases.push(transcript);
    }

    finalTranscript = finalPhrases.join(" ");
    const displayText = [finalTranscript, interimPhrases.join(" ")]
      .filter(Boolean)
      .join(" ");

    onResult(displayText, finalTranscript, lastResult ? lastResult.isFinal : false);
  };

  recognition.onerror = (event) => {
    isRecording = false;
    onError(event.error);
  };

  recognition.onend = () => {
    isRecording = false;
    onEnd(finalTranscript);
  };

  return {
    start: () => {
      if (isRecording) return;
      try {
        recognition.start();
      } catch (err) {
        console.error("Speech recognition start error:", err);
        onError("service-not-allowed");
      }
    },
    stop: () => {
      if (!isRecording) return;
      recognition.stop();
    },
    isRecording: () => isRecording,
  };
}

window.createSpeechRecognition = createSpeechRecognition;
