const GEMINI_DEFAULT_LIST_VERSIONS = ["v1", "v1beta"];

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

async function listGeminiModels(apiKey, options = {}) {
  const {
    versions = GEMINI_DEFAULT_LIST_VERSIONS,
    signal,
    allowExperimental = false,
  } = options || {};

  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }

  const discovered = new Map();
  for (const version of versions) {
    if (!version) continue;
    const endpoint = `https://generativelanguage.googleapis.com/${version}/models?key=${encodeURIComponent(
      apiKey
    )}`;
    let response;
    try {
      response = await fetch(endpoint, { signal });
    } catch (err) {
      console.warn("Failed to list models for", version, err);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`List models ${version} returned ${response.status}`, errText);
      continue;
    }

    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      console.warn("Failed to parse list models payload", err);
      continue;
    }

    const models = Array.isArray(payload.models) ? payload.models : [];
    for (const entry of models) {
      if (!entry) continue;
      const methods = Array.isArray(entry.supportedGenerationMethods)
        ? entry.supportedGenerationMethods
        : [];
      if (methods.length && !methods.includes("generateContent")) {
        continue;
      }

      const name = typeof entry.name === "string" ? entry.name.replace(/^models\//, "") : "";
      if (!name) continue;

      const base = name.toLowerCase();
      const isExperimental = base.includes("experimental") || base.includes("preview");
      if (!allowExperimental && isExperimental) continue;

      if (!discovered.has(name)) {
        discovered.set(name, {
          name,
          displayName: entry.displayName || name,
          description: entry.description || "",
          version,
        });
      }
    }
  }

  return Array.from(discovered.values()).sort((a, b) => a.name.localeCompare(b.name));
}

window.callGeminiApi = callGeminiApi;
window.listGeminiModels = listGeminiModels;
