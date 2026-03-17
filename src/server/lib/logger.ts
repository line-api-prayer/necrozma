type LogLevel = "info" | "warn" | "error";

interface SanitizedLogObject {
  [key: string]: SanitizedLogValue;
}

type SanitizedLogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SanitizedLogValue[]
  | SanitizedLogObject;

export type LogContext = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(secret|token|signature|authorization|password|cookie|key)/i;

function sanitizeValue(key: string, value: unknown): SanitizedLogValue {
  if (value === null || value === undefined) return value;

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    const sanitizedItems = value.map((item) => sanitizeValue(key, item));
    return sanitizedItems;
  }

  if (typeof value === "object") {
    return sanitizeContext(value as Record<string, unknown>);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }

  return value as Exclude<SanitizedLogValue, SanitizedLogValue[] | SanitizedLogObject>;
}

export function sanitizeContext(context: Record<string, unknown>): SanitizedLogObject {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

export function serializeError(error: unknown): SanitizedLogValue {
  if (error instanceof Error) {
    return sanitizeContext({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return sanitizeContext(error as Record<string, unknown>);
  }

  return String(error);
}

function writeLog(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeContext(context),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function createLogger(scope: string, baseContext: LogContext = {}) {
  const withScope = (context?: LogContext) => ({
    scope,
    ...baseContext,
    ...(context ?? {}),
  });

  return {
    child(childContext: LogContext) {
      return createLogger(scope, withScope(childContext));
    },
    info(event: string, context?: LogContext) {
      writeLog("info", event, withScope(context));
    },
    warn(event: string, context?: LogContext) {
      writeLog("warn", event, withScope(context));
    },
    error(event: string, context?: LogContext) {
      writeLog("error", event, withScope(context));
    },
  };
}
