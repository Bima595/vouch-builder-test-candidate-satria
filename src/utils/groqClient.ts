import { logger } from "../logger";

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean,
  hotelId: string,
  shiftDate: string,
  step: "ingestion" | "reconciliation" | "generation" | "grounding" | "output"
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables");
  }

  const payload: any = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
  };

  if (jsonMode) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { hotelId, shiftDate, step, error: errorText },
      `Groq API returned HTTP error ${response.status}`
    );
    throw new Error(`Groq API returned HTTP error ${response.status}: ${errorText}`);
  }

  const result: any = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    logger.error(
      { hotelId, shiftDate, step, meta: { result } },
      "Invalid response format from Groq API"
    );
    throw new Error("Invalid response format from Groq API (no choices or empty content)");
  }

  return content;
}
