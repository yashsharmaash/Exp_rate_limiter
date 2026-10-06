/**
 * Route index — aggregates all route modules.
 */

const { Router } = require("express");
const healthRouter = require("./health");
const apiRouter = require("./api");

const router = Router();

router.use(healthRouter);
router.use(apiRouter);

module.exports = router;
