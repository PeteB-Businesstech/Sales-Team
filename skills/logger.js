/**
 * skills/logger.js
 *
 * Structured Winston logger with TOS compliance scoring.
 * Each log entry records the action taken, the platform, and a compliance
 * assessment so that the human manager can audit the session at any time.
 */

import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize } = format;

// ─── TOS Compliance Levels ────────────────────────────────────────────────────
export const TOS = {
  COMPLIANT: 'COMPLIANT',     // Action fully within TOS
  CAUTION: 'CAUTION',        // Borderline; proceeding with extra care
  VIOLATION: 'VIOLATION',    // Hard stop required
};

// ─── Custom log format ────────────────────────────────────────────────────────
const logFormat = printf(({ level, message, timestamp, platform, tos, meta }) => {
  const tosTag = tos ? ` [TOS:${tos}]` : '';
  const platformTag = platform ? ` [${platform}]` : '';
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}${platformTag}${tosTag}: ${message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
  ],
});

/**
 * Log a TOS-annotated event.
 *
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} opts
 * @param {string} opts.platform  - 'Reddit' | 'LinkedIn' | 'Internal'
 * @param {string} opts.tos       - TOS.COMPLIANT | TOS.CAUTION | TOS.VIOLATION
 * @param {object} [opts.meta]    - Additional structured data
 */
export function logEvent(level, message, { platform = 'Internal', tos = TOS.COMPLIANT, meta } = {}) {
  logger[level](message, { platform, tos, meta });
}

export default logger;
