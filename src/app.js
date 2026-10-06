/**
 * Express application factory.
 *
 * Configures middleware, mounts routes, and returns the app instance
 * (without calling .listen()) so it can be used in tests or composed
 * into a larger service.
 */

const express = require("express");
const routes = require("../routes");

function createApp() {
  const app = express();

  // ── Built-in middleware ────────────────────────────────────────────────────
  app.use(express.json());

  // ── Custom middleware ──────────────────────────────────────────────────────
  const rateLimiter = require('../middleware/rateLimiter');
  app.use(rateLimiter);

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.use(routes);

  return app;
}

module.exports = { createApp };
