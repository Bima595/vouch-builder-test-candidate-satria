import { HandoverOutput, ValidatedHandover, NormalizedEvent, HandoverStatement } from "../types";
import { logger } from "../logger";

export function validateGrounding(
  output: HandoverOutput,
  knownEvents: NormalizedEvent[],
  hotelId: string,
  shiftDate: string
): ValidatedHandover {
  const startTime = Date.now();
  const step = "grounding";

  logger.info(
    { hotelId, shiftDate, step },
    "Starting grounding validation on generated statements"
  );

  const knownRefs = new Set<string>();
  for (const evt of knownEvents) {
    if (evt.sourceRef) {
      knownRefs.add(evt.sourceRef);
    }
  }

  const validated: HandoverStatement[] = [];
  const rejected: HandoverStatement[] = [];

  for (const stmt of output.statements) {
    if (!stmt.sourceEventIds || stmt.sourceEventIds.length === 0) {
      logger.warn(
        { hotelId, shiftDate, step, meta: { statementText: stmt.text } },
        "Statement rejected: sourceEventIds is empty"
      );
      rejected.push(stmt);
      continue;
    }

    const hasPhantomId = stmt.sourceEventIds.some((id) => !knownRefs.has(id));

    if (hasPhantomId) {
      const phantomIds = stmt.sourceEventIds.filter((id) => !knownRefs.has(id));
      logger.warn(
        {
          hotelId,
          shiftDate,
          step,
          meta: { statementText: stmt.text, phantomIds },
        },
        "Statement rejected: contains phantom sourceEventIds not in corpus"
      );
      rejected.push(stmt);
    } else {
      validated.push(stmt);
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info(
    {
      hotelId,
      shiftDate,
      step,
      durationMs,
      meta: {
        totalGenerated: output.statements.length,
        validatedCount: validated.length,
        rejectedCount: rejected.length,
      },
    },
    "Completed grounding validation"
  );

  return {
    validated,
    rejected,
    flags: output.flags,
  };
}
