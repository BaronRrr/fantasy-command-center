/**
 * Centralized Logger Utility
 * Prevents memory leaks from multiple Winston instances
 */
const winston = require('winston');

// Singleton logger instance
let loggerInstance = null;

const createLogger = (level = 'info') => {
  if (loggerInstance) {
    return loggerInstance;
  }

  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  );

  loggerInstance = winston.createLogger({
    level: level,
    format: logFormat,
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true
      })
    ],
    exitOnError: false
  });

  return loggerInstance;
};

module.exports = createLogger;