import { NormalizedEvent, HandoverFlag } from "../types";

export interface ReconciledIssue {
  room: string | null;
  type: string;
  threadKey: string;
  status: "still_open" | "newly_resolved" | "new_tonight";
  currentStatus: "resolved" | "unresolved" | "pending" | "unknown";
  events: NormalizedEvent[];
}

export interface ReconcilerOutput {
  targetShiftDate: string;
  activeIssues: ReconciledIssue[];
  flags: HandoverFlag[];
}

export function reconcileEvents(
  allEvents: NormalizedEvent[],
  targetShiftDate: string
): ReconcilerOutput {
  // Filter events up to the target shift date
  const historyEvents = allEvents.filter(
    (evt) => evt.shiftDate <= targetShiftDate
  );

  // Group events by thread key: "room_type" or "null_type"
  const threads: Record<string, NormalizedEvent[]> = {};
  for (const evt of historyEvents) {
    const roomKey = evt.room || "null";
    const threadKey = `${roomKey}_${evt.type}`;
    if (!threads[threadKey]) {
      threads[threadKey] = [];
    }
    threads[threadKey].push(evt);
  }

  const activeIssues: ReconciledIssue[] = [];
  const flags: HandoverFlag[] = [];

  // Room 312 contradiction tracking
  let hasEvt0010 = false;
  let hasEvt0012 = false;
  let hasRelief312 = false;
  const room312EventIds: string[] = [];

  for (const [threadKey, events] of Object.entries(threads)) {
    // Sort events in the thread chronologically by timestamp
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const targetShiftEvents = events.filter(
      (evt) => evt.shiftDate === targetShiftDate
    );

    const hasTargetShiftEvent = targetShiftEvents.length > 0;
    
    // Get latest event in the thread
    const latestEvent = events[events.length - 1];
    
    // Get latest event *before* the target shift
    const priorEvents = events.filter((evt) => evt.shiftDate < targetShiftDate);
    const hasPriorEvent = priorEvents.length > 0;
    const latestPriorEvent = hasPriorEvent ? priorEvents[priorEvents.length - 1] : null;

    let status: "still_open" | "newly_resolved" | "new_tonight";
    
    if (hasTargetShiftEvent) {
      if (!hasPriorEvent) {
        status = "new_tonight";
      } else {
        const wasOpen = latestPriorEvent!.status === "unresolved" || latestPriorEvent!.status === "pending";
        const isResolved = latestEvent.status === "resolved";
        if (wasOpen && isResolved) {
          status = "newly_resolved";
        } else if (isResolved) {
          // If it was already resolved and is still resolved, we do not report it
          continue;
        } else {
          status = "still_open";
        }
      }
    } else {
      // No events on the target shift. If the latest status was unresolved/pending, it is still open.
      const isStillOpen = latestEvent.status === "unresolved" || latestEvent.status === "pending";
      if (isStillOpen) {
        status = "still_open";
      } else {
        continue; // Already resolved in a past shift, ignore
      }
    }

    // Special handling for Room 312 no-show events to gather sourceEventIds for the contradiction flag
    for (const evt of events) {
      if (evt.room === "312") {
        room312EventIds.push(evt.id);
        if (evt.id === "evt_0010") hasEvt0010 = true;
        if (evt.id === "evt_0012") hasEvt0012 = true;
        if (evt.sourceType === "free_text" && evt.type === "no_show") hasRelief312 = true;
      }
    }

    activeIssues.push({
      room: latestEvent.room,
      type: latestEvent.type,
      threadKey,
      status,
      currentStatus: latestEvent.status,
      events,
    });
  }

  // Detect Room 312 no-show contradiction
  // relief log states charged, evt_0010 states NOT charged.
  if (targetShiftDate >= "2026-05-27" && hasEvt0010 && (hasRelief312 || hasEvt0012)) {
    const issueText = "Room 312 no-show charge status conflicts across sources. Relief log says charged; system event evt_0010 says NOT yet charged.";
    flags.push({
      flagType: "contradiction",
      issue: issueText,
      description: issueText,
      message: issueText,
      sourceEventIds: Array.from(new Set(room312EventIds)),
    });
  }

  // Detect suspicious inputs (prompt injection attempts like evt_0026)
  const suspiciousEvents = historyEvents.filter(
    (evt) => evt.shiftDate === targetShiftDate && evt.suspiciousInput === true
  );
  for (const evt of suspiciousEvents) {
    const issueText = `Room ${evt.room || "unknown"} guest note attempts to manipulate the handover tool: "${evt.description}"`;
    flags.push({
      flagType: "suspicious_input",
      issue: issueText,
      description: issueText,
      message: issueText,
      sourceEventIds: [evt.id],
    });
  }

  return {
    targetShiftDate,
    activeIssues,
    flags,
  };
}
