const express = require("express");
const controller = require("../controllers/bid.controller");
const authRequired = require("../middleware/authRequired");
const requireRole = require("../middleware/requireRole");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/", authRequired, upload.array("files", 10), controller.submitBid);
router.get("/my", authRequired, controller.getMyBids);
router.put("/:id/audit", authRequired, controller.auditBid);
router.get("/all", authRequired, requireRole("auditor"), controller.getAllBids);
router.get("/tender/:tenderId/approved", authRequired, controller.getApprovedBidsByTender);


module.exports = router;