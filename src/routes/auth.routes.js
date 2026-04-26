const express = require("express");
const controller = require("../controllers/auth.controller");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/signup", upload.single("company_certificate"), controller.signup);
router.post("/login", controller.login);
router.post("/verify-code", controller.verifyCode);

module.exports = router;