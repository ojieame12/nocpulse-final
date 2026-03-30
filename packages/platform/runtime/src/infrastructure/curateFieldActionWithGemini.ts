import type { FieldActionCuration } from "@fieldpulse/module-crop-intelligence";

type CurateFieldActionWithGeminiInput = {
  apiKey: string;
  modelKey: string;
  facts: Record<string, unknown>;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

function parseGeminiText(response: GeminiGenerateContentResponse) {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (text && text.length > 0) {
    return text;
  }

  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini blocked field-action curation: ${blockReason}`);
  }

  throw new Error("Gemini returned no text for field-action curation");
}

function trimTo(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

export async function curateFieldActionWithGemini(
  input: CurateFieldActionWithGeminiInput,
): Promise<Omit<FieldActionCuration, "inputVersion" | "generatedAt">> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.modelKey)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are curating copy for an existing farm intelligence card. Use only the provided facts. Never invent findings, zones, crop stage, severity, or metrics. If facts indicate active intelligence, keep the wording direct and agronomic. Return strict JSON only with keys recommendation, explanation, inspectFirst, whyNow, supportingContext, confidence.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{
            text: JSON.stringify({
              task: "Rewrite the field action text for the existing UI slots without changing the underlying facts.",
              constraints: {
                recommendationMaxWords: 24,
                explanationMaxSentences: 3,
                inspectFirstMaxSentences: 1,
                whyNowMaxSentences: 1,
                supportingContextMaxSentences: 2,
                confidenceMaxWords: 4,
              },
              facts: input.facts,
            }),
          }],
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Gemini field-action curation failed (${response.status}): ${await response.text()}`,
    );
  }

  const raw = parseGeminiText(
    await response.json() as GeminiGenerateContentResponse,
  );
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const recommendation = trimTo(parsed.recommendation, 180);
  const explanation = trimTo(parsed.explanation, 520);
  const inspectFirst = trimTo(parsed.inspectFirst, 260);
  const whyNow = trimTo(parsed.whyNow, 260);
  const supportingContext = trimTo(parsed.supportingContext, 360);
  const confidence = trimTo(parsed.confidence, 40);

  if (
    !recommendation ||
    !explanation ||
    !inspectFirst ||
    !whyNow ||
    !supportingContext
  ) {
    throw new Error("Gemini field-action curation returned incomplete JSON");
  }

  return {
    provider: "google-gemini",
    modelKey: input.modelKey,
    recommendation,
    explanation,
    inspectFirst,
    whyNow,
    supportingContext,
    confidence,
  };
}
