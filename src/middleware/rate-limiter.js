/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */
const createLogger = require('../utils/logger');
const config = require('../config/environment');

const logger = createLogger();

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.config = config.rateLimiting.api;
    
    // Cleanup old entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Create rate limiting middleware
   */
  createMiddleware(options = {}) {
    const windowMs = options.windowMs || this.config.windowMs;
    const max = options.max || this.config.max;
    const message = options.message || 'Too many requests, please try again later.';

    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create request history for this key
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const requests = this.requests.get(key);
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      this.requests.set(key, validRequests);

      if (validRequests.length >= max) {
        logger.warn(`Rate limit exceeded for ${key}`, { 
          ip: req.ip, 
          userAgent: req.get('user-agent'),
          endpoint: req.path 
        });
        
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add current request
      validRequests.push(now);
      this.requests.set(key, validRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - validRequests.length),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });

      next();
    };
  }

  /**
   * Get unique key for rate limiting (by IP)
   */
  getKey(req) {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    let cleaned = 0;

    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
        cleaned++;
      } else {
        this.requests.set(key, validRequests);
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      totalKeys: this.requests.size,
      windowMs: this.config.windowMs,
      maxRequests: this.config.max,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new RateLimiter();