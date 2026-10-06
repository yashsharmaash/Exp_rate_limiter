const { createClient } = require('redis');
const { env } = require('./env');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

// 1. Create a Redis connection manager
const client = createClient({
  url: env.REDIS_URL
});

// 2. Wire up lifecycle event listeners
client.on('error', (err) => logger.error({ err }, 'Redis Client Error'));
client.on('connect', () => logger.info('Redis Client Connected'));
client.on('ready', () => logger.info('Redis Client Ready'));

// Global cache for the Lua script SHA-1 hash
let slidingWindowScriptSha = null;
const scriptPath = path.join(__dirname, '../src/lua/sliding_window.lua');
const slidingWindowScript = fs.readFileSync(scriptPath, 'utf8');

async function loadLuaScript() {
  try {
    // Compute its SHA-1 hash (fallback/offline calculation)
    const computedSha = crypto
      .createHash('sha1')
      .update(slidingWindowScript)
      .digest('hex');
    
    // Load this Lua script into Redis memory on application startup
    const loadedSha = await client.scriptLoad(slidingWindowScript);
    
    // Cache the hash in a global variable
    slidingWindowScriptSha = loadedSha; 
    logger.info({ sha: slidingWindowScriptSha }, 'Lua script loaded');
  } catch (error) {
    logger.error({ err: error }, 'Failed to load Lua script');
  }
}

async function connectRedis() {
  await client.connect();
  await loadLuaScript();
}

async function disconnectRedis() {
  await client.quit();
}

/**
 * Executes the sliding window rate limiter script.
 * Handles NOSCRIPT compilation fallbacks if Redis restarts.
 */
async function executeSlidingWindow(key, nowMs, windowMs, limit, uniqueId) {
  if (!slidingWindowScriptSha) {
    throw new Error('Lua script has not been loaded yet.');
  }

  try {
    return await client.evalSha(
      slidingWindowScriptSha,
      {
        keys: [key],
        arguments: [
          nowMs.toString(),
          windowMs.toString(),
          limit.toString(),
          uniqueId
        ]
      }
    );
  } catch (error) {
    // Handle NOSCRIPT compilation fallbacks if Redis restarts
    if (error.message && error.message.includes('NOSCRIPT')) {
      logger.warn('NOSCRIPT error detected. Reloading Lua script...');
      slidingWindowScriptSha = await client.scriptLoad(slidingWindowScript);
      
      // Retry execution
      return await client.evalSha(
        slidingWindowScriptSha,
        {
          keys: [key],
          arguments: [
            nowMs.toString(),
            windowMs.toString(),
            limit.toString(),
            uniqueId
          ]
        }
      );
    }
    throw error;
  }
}

module.exports = {
  client,
  connectRedis,
  disconnectRedis,
  executeSlidingWindow
};
