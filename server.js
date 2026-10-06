/**
 * Server entry point.
 *
 * 1. Validates environment variables (exits on failure).
 * 2. Creates the Express app.
 * 3. Starts listening on the configured PORT.
 */

// Config is imported first — if validation fails the process exits before
// any other module has a chance to run with bad configuration.
const { env } = require("./config/env");
const { createApp } = require("./src/app");
const { connectRedis, disconnectRedis } = require("./config/redis");
const logger = require("./config/logger");

const app = createApp();

// Accurately intercept the client's real IP address behind load balancers
app.set('trust proxy', 1);

let server;

connectRedis().then(() => {
  server = app.listen(env.PORT, () => {
    logger.info({
      port: env.PORT,
      redisUrl: env.REDIS_URL,
      rateLimitMax: env.RATE_LIMIT_MAX,
      rateLimitWindow: env.RATE_LIMIT_WINDOW_MS
    }, 'Server listening');
  });
}).catch(err => {
  logger.fatal({ err }, "Failed to initialize Redis");
  process.exit(1);
});

// ── Graceful Shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');
  
  if (server) {
    // Stop accepting new connections and finish in-flight requests
    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error closing Express server');
      } else {
        logger.info('Express server closed');
      }
      
      try {
        // Close the Redis client connection safely using .quit()
        await disconnectRedis();
        logger.info('Redis client disconnected cleanly');
        process.exit(0);
      } catch (redisErr) {
        logger.error({ err: redisErr }, 'Error disconnecting from Redis');
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
