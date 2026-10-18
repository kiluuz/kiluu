type LogLevel = "info" | "warn" | "error" | "debug";

function emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => emit("error", msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", msg, extra);
  },
};
