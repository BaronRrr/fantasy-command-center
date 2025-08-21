/**
 * Centralized Error Handling Utility
 * Provides consistent error handling across the application
 */
const createLogger = require('./logger');

class ErrorHandler {
  constructor() {
    this.logger = createLogger();
  }

  /**
   * Handle API errors consistently
   */
  handleAPIError(error, context = '') {
    const errorInfo = {
      context,
      message: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString()
    };

    // Don't log sensitive data
    if (error.response?.data && !this.containsSensitiveData(error.response.data)) {
      errorInfo.responseData = error.response.data;
    }

    this.logger.error('API Error:', errorInfo);
    
    return {
      success: false,
      error: this.sanitizeErrorMessage(error.message),
      status: error.response?.status || 500
    };
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field, value, expectedType) {
    const message = `Invalid ${field}: expected ${expectedType}, got ${typeof value}`;
    this.logger.warn('Validation Error:', { field, value: this.sanitizeValue(value), expectedType });
    
    return {
      success: false,
      error: message,
      status: 400
    };
  }

  /**
   * Handle async operation errors with retry logic
   */
  async withRetry(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(`Operation failed after ${maxRetries} attempts:`, error.message);
          throw error;
        }
        
        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await this.delay(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }

  /**
   * Sanitize error messages to prevent information disclosure
   */
  sanitizeErrorMessage(message) {
    // Remove sensitive patterns
    return message
      .replace(/api[_-]?key[s]?[=:]\s*[^\s]+/gi, 'api_key=[REDACTED]')
      .replace(/token[s]?[=:]\s*[^\s]+/gi, 'token=[REDACTED]')
      .replace(/password[s]?[=:]\s*[^\s]+/gi, 'password=[REDACTED]');
  }

  /**
   * Check if data contains sensitive information
   */
  containsSensitiveData(data) {
    const sensitiveKeys = ['apiKey', 'token', 'password', 'secret', 'key'];
    const dataStr = JSON.stringify(data).toLowerCase();
    return sensitiveKeys.some(key => dataStr.includes(key));
  }

  /**
   * Sanitize values for logging
   */
  sanitizeValue(value) {
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return value;
  }

  /**
   * Async delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Global error handler for uncaught exceptions
   */
  setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      // Give time for logs to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}

module.exports = new ErrorHandler();