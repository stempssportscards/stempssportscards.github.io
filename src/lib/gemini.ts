export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export interface Identification {
  player: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  grade: string;
  source: "gemini" | "mock";
}

const PROMPT = `You identify one sports trading card from a photo.
Return only JSON with these string fields: player, year, setName, cardNumber, parallel, grade.
- player: the person on the card.
- year: the card's season, such as 2024 or 2023-24.
- setName: brand and set, such as Panini Prizm or Topps Chrome.
- cardNumber: the printed number without a # sign.
- parallel: the variant, such as Silver, Gold /10, Refractor, or Downtown. Use Base for a base card. Empty if you cannot tell.
- grade: the slab grade, such as PSA 10 or BGS 9.5. Empty if the card is raw.
Use empty strings when a field is not visible. Do not invent a grade. Do not include prices.`;

export function mockIdentification(): Identification {
  return {
    player: "Sample Player",
    year: "2024",
    setName: "Panini Prizm",
    cardNumber: "1",
    parallel: "Silver",
    grade: "",
    source: "mock",
  };
}

function field(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

export function parseIdentification(text: string): Omit<Identification, "source"> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Gemini did not return card details.");
  const json = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  return {
    player: field(json.player),
    year: field(json.year),
    setName: field(json.setName) || field(json.set) || field(json.brand),
    cardNumber: field(json.cardNumber).replace(/^#/, ""),
    parallel: field(json.parallel) || field(json.variant),
    grade: field(json.grade),
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the photo."));
    reader.readAsDataURL(blob);
  });
}

function geminiMessage(status: number, raw: string, model: string): string {
  let message = raw;
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } };
    if (json.error?.message) message = json.error.message;
  } catch {
    /* use the raw body */
  }
  if (status === 429) return "Gemini's free limit is used up for the moment. Wait a bit, or type the card in yourself.";
  if (/api key/i.test(message)) return "That Gemini key was rejected. Create one in Google AI Studio and paste it in Settings.";
  if (status === 404 || /not found|not supported/i.test(message)) {
    return `Gemini didn't recognize the model "${model}". In Settings, try gemini-3.8-flash.`;
  }
  return message || "Gemini could not read this photo.";
}

function textFromResponse(json: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("\n");
}

export async function identifyWithGemini(blob: Blob, apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<Identification> {
  const data = await blobToBase64(blob);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const generationConfig: { temperature: number; responseMimeType?: string } = {
    temperature: 0.2,
    responseMimeType: "application/json",
  };
  const payload = () =>
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: PROMPT }, { inlineData: { mimeType: blob.type || "image/jpeg", data } }],
        },
      ],
      generationConfig,
    });

  let response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload(),
  });
  if (!response.ok) {
    const raw = await response.text();
    if (generationConfig.responseMimeType && /responseMimeType|unknown name/i.test(raw)) {
      delete generationConfig.responseMimeType;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload(),
      });
      if (!response.ok) throw new Error(geminiMessage(response.status, await response.text(), model));
    } else {
      throw new Error(geminiMessage(response.status, raw, model));
    }
  }
  const json = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = textFromResponse(json);
  if (!text.trim()) throw new Error("Gemini returned no card details.");
  return { ...parseIdentification(text), source: "gemini" };
}
