async function callGeminiApi(apiKey, model, version, requestBody) {
  const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let serverMsg = errorText;
    try {
      serverMsg = JSON.parse(errorText)?.error?.message || errorText;
    } catch {} // eslint-disable-line no-empty
    throw new Error(`HTTP ${res.status}: ${serverMsg}`);
  }

  const responseText = await res.text();
  let output = "";
  try {
    const data = JSON.parse(responseText);
    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts?.length) {
      output = candidate.content.parts
        .map((p) => (typeof p.text === "string" ? p.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  } catch (parseErr) {
    console.warn("Non-JSON response received", parseErr);
    output = responseText;
  }

  return output || "No response text returned.";
}

window.callGeminiApi = callGeminiApi;
