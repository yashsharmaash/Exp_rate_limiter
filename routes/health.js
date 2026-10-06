/**
 * Health-check route.
 *
 * GET /health → { status: "ok", uptime }
 */

const { Router } = require("express");

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

module.exports = router;
