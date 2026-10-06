/**
 * Environment configuration with strict validation.
 *
 * Loads variables from .env via dotenv and validates them against a Zod schema.
 * If any variable is missing or malformed the process exits immediately with a
 * descriptive error so misconfigurations never reach production silently.
 */

const dotenv = require("dotenv");
const { z } = require("zod");
const logger = require("./logger");

// ── Load .env ──────────────────────────────────────────────────────────────────
dotenv.config();

// ── Schema ─────────────────────────────────────────────────────────────────────
const envSchema = z.object({
  PORT: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .describe("TCP port the HTTP server listens on"),

  REDIS_URL: z
    .string()
    .url()
    .startsWith("redis", { message: "REDIS_URL must use the redis:// protocol" })
    .describe("Redis connection string"),

  RATE_LIMIT_MAX: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .describe("Maximum number of requests allowed per window"),

  RATE_LIMIT_WINDOW_MS: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .describe("Rate-limit sliding window duration in milliseconds"),
});

// ── Validate ───────────────────────────────────────────────────────────────────
const result = envSchema.safeParse(process.env);

if (!result.success) {
  logger.fatal("Environment validation failed");

  for (const issue of result.error.issues) {
    logger.fatal(`  ✖  ${issue.path.join(".")} — ${issue.message}`);
  }

  logger.fatal("Check your .env file against .env.example and try again.");
  process.exit(1);
}

/** @type {z.infer<typeof envSchema>} */
const env = Object.freeze(result.data);

module.exports = { env, envSchema };
