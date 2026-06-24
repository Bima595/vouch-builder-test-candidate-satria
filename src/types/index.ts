export type EventType =
  | "check_in"
  | "maintenance"
  | "compliance"
  | "complaint"
  | "lost_keycard"
  | "check_in_issue"
  | "deposit_issue"
  | "facilities"
  | "no_show"
  | "walk_in"
  | "finance_note"
  | "incident"
  | "early_checkout_request"
  | "damage_report"
  | "note"
  | "guest_message";

export interface RawStructuredEvent {
  id: string;
  timestamp: string;
  type: EventType;
  room: string | null;
  guest: string | null;
  description: string;
  status: "resolved" | "unresolved" | "pending";
}

export interface NormalizedEvent {
  id: string;
  shiftDate: string;
  timestamp: string;
  type: EventType;
  room: string | null;
  guest: string | null;
  description: string;
  status: "resolved" | "unresolved" | "pending" | "unknown";
  sourceType: "structured" | "free_text";
  /**
   * Grounding anchor for every statement the LLM produces.
   * For structured events: the original event ID (e.g. "evt_0026").
   * For free-text events: a generated reference (e.g. "ft_0001", "ft_line_12").
   * The grounding validator checks every HandoverStatement.sourceEventIds
   * against the Set of known sourceRefs. Any ID not in this Set causes
   * the statement to be moved to ValidatedHandover.rejected[].
   * This field is REQUIRED — never undefined, never empty string.
   */
  sourceRef: string;
  /**
   * true only when the event description contains content that
   * appears to be a prompt injection attempt (e.g. evt_0026).
   * Optional — omit for normal events.
   */
  suspiciousInput?: boolean;
}

export interface HandoverStatement {
  priority: "urgent" | "pending" | "fyi";
  status: "still_open" | "newly_resolved" | "new_tonight";
  text: string;
  sourceEventIds: string[];
}

export interface HandoverFlag {
  issue: string;
  sourceEventIds: string[];
  /**
   * "suspicious_input": the source event contains content that
   * appears designed to manipulate the handover output — e.g. a guest
   * note instructing the system to ignore other events or add credits.
   * This is a real attack vector: hotel guest notes are external,
   * untrusted input that reaches the LLM context. Flag, do not process.
   */
  flagType: "contradiction" | "incomplete" | "ungrounded" | "suspicious_input";
  description?: string; // for compatibility with test runners
  message?: string; // for compatibility with test runners
}

export interface HandoverOutput {
  statements: HandoverStatement[];
  flags: HandoverFlag[];
}

export interface ValidatedHandover {
  validated: HandoverStatement[];
  rejected: HandoverStatement[];
  flags: HandoverFlag[];
}

export interface LogContext {
  hotelId: string;
  shiftDate: string;
  step: "ingestion" | "reconciliation" | "generation" | "grounding" | "output";
  durationMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}
