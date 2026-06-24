import express, { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { parseStructuredEvents } from "./parsers/jsonParser";
import { parseFreeTextLog } from "./parsers/freeTextParser";
import { reconcileEvents } from "./reconciler";
import { generateHandover } from "./generator";
import { validateGrounding } from "./validator/groundingValidator";
import { formatHandover } from "./output/formatter";
import { logger } from "./logger";
import { NormalizedEvent } from "./types";

const app = express();
app.use(express.json());

// In-Memory Rate Limiting Configuration
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per IP per window

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    logger.warn(
      {
        hotelId: (req.body?.hotelId as string) || "unknown",
        shiftDate: (req.body?.shiftDate as string) || "unknown",
        step: "output",
        meta: { ip, requestCount: record.count },
      },
      "Rate limit exceeded by IP"
    );
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
    });
    return;
  }

  record.count += 1;
  next();
}

const RequestSchema = z.object({
  hotelId: z.string(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
});

// GET /health endpoint (rate limited)
app.get("/health", rateLimiter, (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// POST /handover endpoint (rate limited)
app.post("/handover", rateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const step = "ingestion";
  let hotelId = "unknown";
  let shiftDate = "unknown";

  try {
    const parsedBody = RequestSchema.parse(req.body);
    hotelId = parsedBody.hotelId;
    shiftDate = parsedBody.shiftDate;

    if (hotelId !== "lumen-sg") {
      res.status(404).json({ error: `Hotel '${hotelId}' not found. Supported hotel is 'lumen-sg'.` });
      return;
    }

    const startTime = Date.now();
    logger.info({ hotelId, shiftDate, step }, "Starting handover request processing");

    // 1. Ingestion: Load data files from disk
    const eventsPath = path.join(process.cwd(), "data", "events.json");
    const logsPath = path.join(process.cwd(), "data", "night-logs.md");

    let rawEventsJson: any;
    let rawNightLogsMd = "";

    try {
      const eventsData = await fs.readFile(eventsPath, "utf-8");
      rawEventsJson = JSON.parse(eventsData);
    } catch (err: any) {
      logger.error({ hotelId, shiftDate, step, error: err.message }, "Failed to read structured events.json");
      res.status(500).json({ error: "Structured events file not found or corrupted" });
      return;
    }

    try {
      rawNightLogsMd = await fs.readFile(logsPath, "utf-8");
    } catch (err: any) {
      logger.warn({ hotelId, shiftDate, step, error: err.message }, "night-logs.md not found, proceeding without it");
    }

    const hotelName = rawEventsJson.hotel?.name || "Lumen Boutique Hotel";

    // Parse structured events
    const normalizedStructured = parseStructuredEvents(rawEventsJson.events || []);

    // Log suspicious inputs/prompt injection in structured events
    const suspiciousStructured = normalizedStructured.filter((e) => e.suspiciousInput);
    if (suspiciousStructured.length > 0) {
      logger.warn(
        {
          hotelId,
          shiftDate,
          step,
          meta: {
            suspiciousEvents: suspiciousStructured.map((e) => ({ id: e.id, description: e.description })),
          },
        },
        "Prompt injection attempt detected in structured events"
      );
    }

    // Parse free text logs (only if we have content)
    let normalizedFreeText: NormalizedEvent[] = [];
    if (rawNightLogsMd.trim()) {
      try {
        normalizedFreeText = await parseFreeTextLog(rawNightLogsMd);
      } catch (err: any) {
        logger.error({ hotelId, shiftDate, step, error: err.message }, "Failed to parse free-text logs");
        res.status(500).json({ error: `Free text parser failed: ${err.message}` });
        return;
      }
    }

    // Log suspicious inputs/prompt injection in free text logs
    const suspiciousFreeText = normalizedFreeText.filter((e) => e.suspiciousInput);
    if (suspiciousFreeText.length > 0) {
      logger.warn(
        {
          hotelId,
          shiftDate,
          step,
          meta: {
            suspiciousEvents: suspiciousFreeText.map((e) => ({ id: e.id, description: e.description })),
          },
        },
        "Prompt injection attempt detected in free-text logs"
      );
    }

    // Combine all events
    const allEvents = [...normalizedStructured, ...normalizedFreeText];

    const ingestionDuration = Date.now() - startTime;
    logger.info(
      { hotelId, shiftDate, step, durationMs: ingestionDuration, meta: { eventCount: allEvents.length } },
      "Ingestion and normalization completed successfully"
    );

    // 2. Reconciliation
    const reconciliationStart = Date.now();
    const reconciled = reconcileEvents(allEvents, shiftDate);
    const reconciliationDuration = Date.now() - reconciliationStart;

    // Log reconciliation flags / anomalies
    if (reconciled.flags.length > 0) {
      logger.warn(
        {
          hotelId,
          shiftDate,
          step: "reconciliation",
          meta: {
            flags: reconciled.flags.map((f) => ({
              flagType: f.flagType,
              issue: f.issue,
              sourceEventIds: f.sourceEventIds,
            })),
          },
        },
        "Reconciliation anomalies or contradictions flagged"
      );
    }

    // Log active issues summary for developer visibility
    const issueSummary = reconciled.activeIssues.map((issue) => ({
      room: issue.room,
      type: issue.type,
      status: issue.status,
      currentStatus: issue.currentStatus,
      eventCount: issue.events.length,
    }));
    logger.info(
      {
        hotelId,
        shiftDate,
        step: "reconciliation",
        durationMs: reconciliationDuration,
        meta: { issueSummary },
      },
      "Reconciliation completed successfully"
    );

    // 3. Generation
    const generated = await generateHandover(reconciled, hotelId);

    // 4. Grounding
    const validated = validateGrounding(generated, allEvents, hotelId, shiftDate);

    // Log grounding rejections if any exist
    if (validated.rejected.length > 0) {
      logger.warn(
        {
          hotelId,
          shiftDate,
          step: "grounding",
          meta: {
            rejectedCount: validated.rejected.length,
            rejectedTexts: validated.rejected.map((s) => s.text),
          },
        },
        "Grounding validation warning: some generated statements were rejected due to insufficient references"
      );
    }

    // 5. Output rendering
    const formatParam = req.query.format as string;
    const acceptHeader = req.headers.accept || "";
    const formatType = (formatParam === "html" || acceptHeader.includes("text/html")) ? "html" : "json";

    const formattedOutput = formatHandover(validated, formatType, hotelName, shiftDate);

    if (formatType === "html") {
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(formattedOutput);
    } else {
      res.status(200).json(formattedOutput);
    }

    const totalDuration = Date.now() - startTime;
    logger.info(
      { hotelId, shiftDate, step: "output", durationMs: totalDuration },
      "Handover request completed successfully"
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request body", details: err.issues });
      return;
    }
    next(err);
  }
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(
    { hotelId: "unknown", shiftDate: "unknown", step: "output", error: err.message },
    "Unhandled application error"
  );
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

export default app;
