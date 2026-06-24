/** Minimal leveled logger. Swap the implementation for Sentry/etc. later. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  (import.meta.env?.MODE === 'production' ? 'info' : 'debug') as LogLevel;

const PREFIX = '[ai&]';

function log(level: LogLevel, msg: string, meta?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  // eslint-disable-next-line no-console
  const fn = level === 'debug' ? console.debug : level === 'error' ? console.error : console.log;
  if (meta !== undefined) fn(`${PREFIX} ${msg}`, meta);
  else fn(`${PREFIX} ${msg}`);
}

export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};
