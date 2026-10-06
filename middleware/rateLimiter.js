const { executeSlidingWindow } = require('../config/redis');
const { env } = require('../config/env');
const crypto = require('crypto');
const logger = require('../config/logger');

async function rateLimiter(req, res, next) {
  try {
    // Intercept client IP. `req.ip` is populated correctly because of `trust proxy`
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}`;
    
    const nowMs = Date.now();
    const limit = env.RATE_LIMIT_MAX;
    const windowMs = env.RATE_LIMIT_WINDOW_MS;
    
    // ZSET requires unique members. Append random hex to timestamp.
    const uniqueId = `${nowMs}-${crypto.randomBytes(4).toString('hex')}`;

    // Invoke the cached Lua script
    const result = await executeSlidingWindow(key, nowMs, windowMs, limit, uniqueId);
    
    const allowed = result[0] === 1;
    const remaining = result[1];

    if (allowed) {
      // If allowed: Set headers and invoke next()
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      return next();
    } else {
      // If blocked: Set Retry-After and return 429 JSON payload
      // (Since our Lua script currently returns [0, 0] without an exact wait time,
      // we'll safely estimate the Retry-After using the full window size in seconds)
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      
      return res.status(429).json({
        status: 'error',
        message: 'Too Many Requests',
        details: `You have exceeded the rate limit of ${limit} requests per ${windowMs}ms.`
      });
    }
  } catch (error) {
    // Fail-Open strategy: Log failure but execute next() so traffic is not disrupted
    logger.error({ err: error }, 'Rate Limiting Failed (Failing Open) - Redis Error');
    next();
  }
}

module.exports = rateLimiter;
