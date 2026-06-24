import { NormalizedEvent } from "../types";
import { callGroq } from "../utils/groqClient";

export async function parseFreeTextLog(
  text: string
): Promise<NormalizedEvent[]> {
  const systemPrompt = `You are a senior hotel operations parser. Ingest the free-text night logs (which may contain mixed English and Mandarin) and parse them into a list of structured events.

For each event in the logs, you must extract:
1. Room number (string, e.g., "112", or null if not mentioned/unknown)
2. Guest name (string, or null if not mentioned/unknown)
3. Event type. You MUST select one of the following exact types:
   - "check_in"
   - "maintenance"
   - "compliance"
   - "complaint"
   - "lost_keycard"
   - "check_in_issue"
   - "deposit_issue"
   - "facilities"
   - "no_show"
   - "walk_in"
   - "finance_note"
   - "incident"
   - "early_checkout_request"
   - "damage_report"
   - "note"
   - "guest_message"
4. Description: Write a clear description in English. If the original text is in Mandarin, translate it to English, but keep all critical details (e.g. amounts, flight schedules, flight details, currency, passport details).
5. Status: "resolved" | "unresolved" | "pending".
   - If the log says "settled", "resolved", "mopped and dry", "sorted itself out", or "fixed", mark as "resolved".
   - If the log says "still out of order", "still not fixed", "stays out of order", "needs to be ordered", mark as "unresolved".
   - If the log says "pending", "leaving for morning team", "not yet settled", "chasing", mark as "pending".
6. ShiftDate: Determine the shift start date in YYYY-MM-DD format (Singapore time).
   - The night shift of Wed 27 May -> shiftDate is "2026-05-27" (use year 2026).
7. Timestamp: Construct an ISO 8601 timestamp with +08:00 offset. Estimate the time based on the log (e.g. if it mentions 1am, use 2026-05-28T01:00:00+08:00. If no time is mentioned, default to 23:30 on the start date: 2026-05-27T23:30:00+08:00).

Return ONLY a JSON array of objects. Do not include markdown code block wraps like \`\`\`json, and do not write conversational filler text before or after the JSON.
Example output:
[
  {
    "room": "112",
    "guest": null,
    "type": "maintenance",
    "description": "Aircon compressor repair pending parts.",
    "status": "unresolved",
    "shiftDate": "2026-05-27",
    "timestamp": "2026-05-27T23:30:00+08:00"
  }
]`;

  const rawText = await callGroq(
    systemPrompt,
    text,
    true, // jsonMode
    "lumen-sg",
    "2026-05-27",
    "ingestion"
  );

  const trimmedText = rawText.trim();
  
  // Extract JSON block in case the LLM returned markdown code blocks or filler text
  let jsonString = trimmedText;
  const startIdx = trimmedText.indexOf("[");
  const endIdx = trimmedText.lastIndexOf("]");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    jsonString = trimmedText.substring(startIdx, endIdx + 1);
  }

  interface ExtractedEvent {
    room: string | null;
    guest: string | null;
    type: string;
    description: string;
    status: "resolved" | "unresolved" | "pending";
    shiftDate: string;
    timestamp: string;
  }

  const parsedEvents: ExtractedEvent[] = JSON.parse(jsonString);

  // Normalise and assign IDs
  let idCounter = 3; // ft_0001 and ft_0002 are reserved
  
  const normalizedEvents: NormalizedEvent[] = parsedEvents.map((evt) => {
    let id = "";
    
    // Assign mandatory IDs per AGENTS.md rules
    const descLower = evt.description.toLowerCase();
    const isRoom208Safe = evt.room === "208" && (descLower.includes("safe") || descLower.includes("box") || descLower.includes("passport"));
    const isWifiComplaint = descLower.includes("wifi") || descLower.includes("wi-fi");

    if (isRoom208Safe) {
      id = "ft_0001";
    } else if (isWifiComplaint) {
      id = "ft_0002";
    } else {
      id = `ft_${String(idCounter++).padStart(4, "0")}`;
    }

    // Prompt injection check (just in case free text contains injection)
    const INJECTION_PHRASES = [
      "ignore all other items",
      "ignore previous instructions",
      "system note",
      "assistant instruction",
      "tool instruction",
      "override output",
    ];
    const isSuspicious = INJECTION_PHRASES.some((phrase) =>
      descLower.includes(phrase)
    );

    const normalized: NormalizedEvent = {
      id,
      shiftDate: evt.shiftDate,
      timestamp: evt.timestamp,
      type: evt.type as any, // Cast to EventType union
      room: evt.room,
      guest: evt.guest,
      description: evt.description,
      status: evt.status as any,
      sourceType: "free_text",
      sourceRef: id,
    };

    if (isSuspicious) {
      normalized.suspiciousInput = true;
    }

    return normalized;
  });

  return normalizedEvents;
}
