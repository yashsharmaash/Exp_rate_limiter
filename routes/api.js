const { Router } = require("express");

const router = Router();

router.get("/api/resource", (req, res) => {
  res.json({
    status: "success",
    data: "You have accessed the protected resource."
  });
});

module.exports = router;
