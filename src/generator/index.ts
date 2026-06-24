import { z } from "zod";
import { HandoverOutput, HandoverStatement } from "../types";
import { ReconcilerOutput } from "../reconciler";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { logger } from "../logger";
import { callGroq } from "../utils/groqClient";

const StatementSchema = z.object({
  priority: z.enum(["urgent", "pending", "fyi"]),
  status: z.enum(["still_open", "newly_resolved", "new_tonight"]),
  text: z.string(),
  sourceEventIds: z.array(z.string()),
});

const HandoverOutputSchema = z.object({
  statements: z.array(StatementSchema),
});

export async function generateHandover(
  reconciled: ReconcilerOutput,
  hotelId: string
): Promise<HandoverOutput> {
  const startTime = Date.now();
  const step = "generation";

  logger.info(
    { hotelId, shiftDate: reconciled.targetShiftDate, step },
    "Starting handover generation via LLM"
  );

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserMessage(reconciled);

  try {
    const rawText = await callGroq(
      systemPrompt,
      userPrompt,
      true, // jsonMode
      hotelId,
      reconciled.targetShiftDate,
      step
    );

    const trimmedText = rawText.trim();
    
    // Robust extraction of JSON block
    let jsonString = trimmedText;
    const startIdx = trimmedText.indexOf("{");
    const endIdx = trimmedText.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonString = trimmedText.substring(startIdx, endIdx + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr: any) {
      logger.error(
        {
          hotelId,
          shiftDate: reconciled.targetShiftDate,
          step,
          error: parseErr.message,
          meta: { rawText },
        },
        "Failed to parse JSON from LLM output"
      );
      throw new Error(`LLM output did not contain valid JSON: ${parseErr.message}`);
    }

    const validatedData = HandoverOutputSchema.parse(parsed);

    const durationMs = Date.now() - startTime;
    logger.info(
      { hotelId, shiftDate: reconciled.targetShiftDate, step, durationMs },
      "Successfully generated and parsed handover statements from LLM"
    );

    return {
      statements: validatedData.statements as HandoverStatement[],
      flags: reconciled.flags,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error(
      {
        hotelId,
        shiftDate: reconciled.targetShiftDate,
        step,
        durationMs,
        error: err.message,
      },
      "Error during LLM handover generation"
    );
    throw err;
  }
}
