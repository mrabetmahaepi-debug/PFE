type LogContext = Record<string, unknown>;

const formatContext = (context?: LogContext) => {
  if (!context || Object.keys(context).length === 0) return "";
  return ` ${JSON.stringify(context)}`;
};

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(`[info] ${message}${formatContext(context)}`);
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[warn] ${message}${formatContext(context)}`);
  },
  error(message: string, context?: LogContext) {
    console.error(`[error] ${message}${formatContext(context)}`);
  },
};
