import pino from "pino";
import { LogContext } from "./types";

const isProduction = process.env.NODE_ENV === "production";

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Helper for terminal coloring using ANSI escape codes
const colors = {
  reset: "\x1b[0m",
  gray: "\x1b[90m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function formatLevel(level: "info" | "warn" | "error" | "debug"): string {
  switch (level) {
    case "info":
      return `${colors.green}${colors.bold}INFO ${colors.reset}`;
    case "warn":
      return `${colors.yellow}${colors.bold}WARN ${colors.reset}`;
    case "error":
      return `${colors.red}${colors.bold}ERROR${colors.reset}`;
    case "debug":
      return `${colors.blue}${colors.bold}DEBUG${colors.reset}`;
  }
}

function printDevLog(
  level: "info" | "warn" | "error" | "debug",
  context: LogContext,
  message: string
) {
  const timeStr = new Date().toISOString().replace("T", " ").substring(0, 19);
  const time = `${colors.gray}[${timeStr}]${colors.reset}`;
  const lvl = formatLevel(level);
  const step = `${colors.magenta}(${context.step})${colors.reset}`;
  const ids = `${colors.cyan}[${context.hotelId} | ${context.shiftDate}]${colors.reset}`;
  const duration =
    context.durationMs !== undefined
      ? ` ${colors.yellow}(+${context.durationMs}ms)${colors.reset}`
      : "";
  const err = context.error
    ? `\n  ${colors.red}${colors.bold}Error:${colors.reset} ${context.error}`
    : "";
  const meta =
    context.meta && Object.keys(context.meta).length > 0
      ? `\n  ${colors.gray}Meta: ${JSON.stringify(context.meta, null, 2)}${colors.reset}`
      : "";

  console.log(
    `${time} ${lvl} ${step} ${ids} ${colors.bold}${message}${colors.reset}${duration}${err}${meta}`
  );
}

export const logger = {
  info(context: LogContext, message: string) {
    if (isProduction) {
      baseLogger.info(context, message);
    } else {
      printDevLog("info", context, message);
    }
  },
  error(context: LogContext, message: string) {
    if (isProduction) {
      baseLogger.error(context, message);
    } else {
      printDevLog("error", context, message);
    }
  },
  warn(context: LogContext, message: string) {
    if (isProduction) {
      baseLogger.warn(context, message);
    } else {
      printDevLog("warn", context, message);
    }
  },
  debug(context: LogContext, message: string) {
    if (isProduction) {
      baseLogger.debug(context, message);
    } else {
      printDevLog("debug", context, message);
    }
  },
};
