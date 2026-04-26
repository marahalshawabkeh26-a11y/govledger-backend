const bidService = require("../services/bid.service");
const { ok, fail } = require("../utils/response");

// ===============================
// Submit bid (Company only)
// ===============================
async function submitBid(req, res) {
  try {
    if (req.user.role !== "company") {
      return fail(res, "Only companies can submit bids", 403);
    }

    const uploadedFiles = (req.files || []).map((file) => ({
      original_name: file.originalname,
      stored_name: file.filename,
      path: `/uploads/${file.filename}`,
      mime_type: file.mimetype,
      size: file.size,
    }));

    const bid = await bidService.submitBid(
      {
        ...req.body,
        files: uploadedFiles,
      },
      req.user.id
    );
    return ok(res, { bid }, "Bid submitted successfully", 201);
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

// ===============================
// Auditor approves/rejects
// ===============================
async function auditBid(req, res) {
  try {
    if (req.user.role !== "auditor") {
      return fail(res, "Only auditors allowed", 403);
    }

    const { action } = req.body;

    const bid = await bidService.auditBid(
      req.params.id,
      action,
      req.user.id
    );

    return ok(res, { bid }, "Bid updated successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

// ===============================
// Officer gets ONLY approved bids
// ===============================
async function getApprovedBidsByTender(req, res) {
  try {
    if (req.user.role !== "officer") {
      return fail(res, "Only officers allowed", 403);
    }

    const bids = await bidService.getApprovedBidsByTender(req.params.tenderId);
    return ok(res, { bids }, "Approved bids fetched");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

// ===============================
// Company sees ONLY its bids
// ===============================
async function getMyBids(req, res) {
  try {
    if (req.user.role !== "company") {
      return fail(res, "Only companies allowed", 403);
    }

    const bids = await bidService.getMyBids(req.user.id);
    return ok(res, { bids }, "My bids fetched successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

// ===============================
// Auditor gets ALL bids (only)
// ===============================
async function getAllBids(req, res) {
  try {
    if (req.user.role !== "auditor") {
      return fail(res, "Only auditors allowed", 403);
    }

    const bids = await bidService.getAllBids();
    return ok(res, { bids }, "All bids fetched");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

module.exports = {
  submitBid,
  getMyBids,
  auditBid,
  getAllBids,
  getApprovedBidsByTender,
};