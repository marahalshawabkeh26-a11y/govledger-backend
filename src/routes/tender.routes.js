const express = require("express");
const controller = require("../controllers/tender.controller");
const authRequired = require("../middleware/authRequired");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", controller.getAllTenders);
router.get("/open", controller.getOpenTenders);
router.get("/awarded", controller.getAwardedTenders);
router.get("/integrity/verify", authRequired, controller.verifyIntegrity);
router.get("/integrity/verify/:id", authRequired, controller.verifyTenderIntegrity);
router.get("/approved-bids", authRequired, controller.getTendersWithApprovedBids);
router.put("/:id/select-winner", authRequired, controller.selectWinner);
router.post("/", authRequired, upload.array("attachments", 10), controller.createTender);
router.get("/:id", authRequired, controller.getTenderById);

module.exports = router;