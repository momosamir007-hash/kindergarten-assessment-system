import type { AiConfig, AiProviderId } from "./levels";

export type AiModelInfo = {
  id: string;
  name: string;
  description?: string;
};

export type ProviderMeta = {
  id: AiProviderId;
  name: string;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  helpUrl: string;
  defaultModel: string;
};

export const AI_PROVIDERS: Record<AiProviderId, ProviderMeta> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyPlaceholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.5-flash",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-proj-...",
    helpUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
  },
  groq: {
    id: "groq",
    name: "Groq (فائق السرعة)",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    keyPlaceholder: "gsk_...",
    helpUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    keyPlaceholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter (مئات الموديلات)",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-...",
    helpUrl: "https://openrouter.ai/keys",
    defaultModel: "google/gemini-2.5-flash",
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    keyPlaceholder: "...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    defaultModel: "mistral-small-latest",
  },
  custom: {
    id: "custom",
    name: "خادم محلي / مخصص (Ollama / Local)",
    defaultBaseUrl: "http://localhost:11434/v1",
    keyPlaceholder: "اختياري...",
    helpUrl: "",
    defaultModel: "llama3",
  },
};

/** Fetch live, active models from the provider in real time */
export async function fetchLiveModels(
  provider: AiProviderId,
  apiKey: string,
  customBaseUrl?: string,
): Promise<AiModelInfo[]> {
  const meta = AI_PROVIDERS[provider] ?? AI_PROVIDERS.gemini;
  const baseUrl = (customBaseUrl || meta.defaultBaseUrl).replace(/\/$/, "");

  if (provider === "gemini") {
    const key = apiKey.trim();
    if (!key) throw new Error("يرجى إدخال مفتاح Gemini API Key أولاً.");
    const url = `${baseUrl}/models?key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `خطأ Gemini API: ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data.models) ? data.models : [];
    const models: AiModelInfo[] = list
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string; displayName?: string; description?: string }) => {
        const id = m.name.replace(/^models\//, "");
        return {
          id,
          name: m.displayName ? `${m.displayName} (${id})` : id,
          description: m.description,
        };
      });
    return models;
  }

  // OpenAI-compatible providers: OpenAI, Groq, DeepSeek, OpenRouter, Mistral, Custom
  const headers: Record<string, string> = {};
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/kindergarten-eval";
    headers["X-Title"] = "Educational Assessment System";
  }

  const endpoint = provider === "deepseek" ? `${baseUrl}/models` : `${baseUrl}/models`;
  const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `خطأ المزود ${provider}: ${res.status}`);
  }
  const data = await res.json();
  const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];

  const models: AiModelInfo[] = list.map(
    (m: { id?: string; name?: string; description?: string }) => {
      const id = m.id || String(m);
      return {
        id,
        name: m.name ? `${m.name} (${id})` : id,
        description: m.description,
      };
    },
  );

  return models;
}

/** Parse JSON safely even if wrapped in markdown code blocks */
export function extractJsonFromText(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  // Strip markdown ```json ... ```
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1]);
    } catch (_) {}
  }

  // Look for first { to last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  return {};
}

/** Call the selected AI provider with unified prompt & JSON return */
export async function executeAiCall(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const meta = AI_PROVIDERS[config.provider] ?? AI_PROVIDERS.gemini;
  const baseUrl = (config.baseUrl || meta.defaultBaseUrl).replace(/\/$/, "");
  const model = config.model || meta.defaultModel;

  if (config.provider === "gemini") {
    const key = config.apiKey.trim();
    if (!key) throw new Error("مفتاح Gemini API غير مضبوط.");
    const url = `${baseUrl}/models/${model}:generateContent?key=${key}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`خطأ Gemini (${res.status}): ${err.error?.message ?? res.statusText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error("لم يتم استلام أي نص من Gemini.");
    return extractJsonFromText(text);
  }

  // OpenAI-compatible providers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/kindergarten-eval";
    headers["X-Title"] = "Educational Assessment System";
  }

  const bodyPayload: Record<string, unknown> = {
    model,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  // Some providers require or allow response_format: { type: "json_object" }
  let tryWithJsonFormat = true;
  if (config.provider === "groq" || config.provider === "openai" || config.provider === "deepseek") {
    bodyPayload.response_format = { type: "json_object" };
  }

  let res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(60_000),
  });

  // If failed and was using response_format, retry without response_format
  if (!res.ok && tryWithJsonFormat && bodyPayload.response_format) {
    delete bodyPayload.response_format;
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(60_000),
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`خطأ ${config.provider} (${res.status}): ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return extractJsonFromText(content);
}

