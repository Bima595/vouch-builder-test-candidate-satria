import { parseISO, subDays, format } from "date-fns";
import { RawStructuredEvent, NormalizedEvent } from "../types";

const INJECTION_PHRASES = [
  "ignore all other items",
  "ignore previous instructions",
  "system note",
  "assistant instruction",
  "tool instruction",
  "override output",
];

export function deriveShiftDate(timestamp: string): string {
  const date = parseISO(timestamp);
  // Singapore is UTC+8. Add 8 hours to get UTC date representing SG local time.
  const sgTimeMs = date.getTime() + 8 * 60 * 60 * 1000;
  const sgDate = new Date(sgTimeMs);

  const hour = sgDate.getUTCHours();
  const yyyy = sgDate.getUTCFullYear();
  const mm = String(sgDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sgDate.getUTCDate()).padStart(2, "0");
  const sgDateStr = `${yyyy}-${mm}-${dd}`;

  if (hour >= 23) {
    return sgDateStr;
  } else if (hour < 7) {
    const parsedSgLocalDate = parseISO(sgDateStr);
    const prevDate = subDays(parsedSgLocalDate, 1);
    return format(prevDate, "yyyy-MM-dd");
  } else {
    return sgDateStr;
  }
}

export function parseStructuredEvents(
  events: RawStructuredEvent[]
): NormalizedEvent[] {
  return events.map((event) => {
    const shiftDate = deriveShiftDate(event.timestamp);
    const lowerDescription = event.description.toLowerCase();
    const isSuspicious = INJECTION_PHRASES.some((phrase) =>
      lowerDescription.includes(phrase)
    );

    const normalized: NormalizedEvent = {
      id: event.id,
      shiftDate,
      timestamp: event.timestamp,
      type: event.type,
      room: event.room,
      guest: event.guest,
      description: event.description,
      status: event.status,
      sourceType: "structured",
      sourceRef: event.id,
    };

    if (isSuspicious) {
      normalized.suspiciousInput = true;
    }

    return normalized;
  });
}
