const tenderService = require("../services/tender.service");
const { ok, fail } = require("../utils/response");

function sanitizeTenderForPublic(tender) {
  return {
    ...tender,
    chain_proof: null,
  };
}

function sanitizeTenderByRole(tender, role) {
  if (role === "officer" || role === "auditor") {
    return tender;
  }

  return sanitizeTenderForPublic(tender);
}

async function createTender(req, res) {
  try {
    if (req.user.role !== "officer") {
      return fail(res, "Only officers allowed", 403);
    }

    const uploadedAttachments = (req.files || []).map((file) => ({
      original_name: file.originalname,
      stored_name: file.filename,
      path: `/uploads/${file.filename}`,
      mime_type: file.mimetype,
      size: file.size,
    }));

    const tender = await tenderService.createTender(
      {
        ...req.body,
        attachments_json: uploadedAttachments,
      },
      req.user.id
    );
    return ok(res, { tender }, "Tender created successfully", 201);
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function getTendersWithApprovedBids(req, res) {
  try {
    if (req.user.role !== "officer") {
      return fail(res, "Only officers allowed", 403);
    }

    const tenders = await tenderService.getTendersWithApprovedBids();
    return ok(res, { tenders }, "Tenders with approved bids fetched successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function getAllTenders(req, res) {
  try {
    const tenders = await tenderService.getAllTenders();
    const sanitized = tenders.map(sanitizeTenderForPublic);
    return ok(res, { tenders: sanitized }, "Tenders fetched successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function getOpenTenders(req, res) {
  try {
    const tenders = await tenderService.getOpenTenders();
    const sanitized = tenders.map(sanitizeTenderForPublic);
    return ok(res, { tenders: sanitized }, "Open tenders fetched successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function getAwardedTenders(req, res) {
  try {
    const tenders = await tenderService.getAwardedTenders();
    const sanitized = tenders.map(sanitizeTenderForPublic);
    return ok(res, { tenders: sanitized }, "Awarded tenders fetched successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function selectWinner(req, res) {
  try {
    if (req.user.role !== "officer") {
      return fail(res, "Only officers allowed", 403);
    }

    const { bidId } = req.body;

    await tenderService.selectWinner(req.params.id, bidId, req.user.id);

    return ok(res, {}, "Winner selected successfully");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function getTenderById(req, res) {
  try {
    const tender = await tenderService.getTenderById(req.params.id);

    if (!tender) {
      return fail(res, "Tender not found", 404);
    }

    return ok(
      res,
      { tender: sanitizeTenderByRole(tender, req.user?.role) },
      "Tender fetched successfully"
    );
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function verifyTenderIntegrity(req, res) {
  try {
    const report = await tenderService.verifyTenderIntegrity(req.params.id);
    return ok(res, { report }, "Tender integrity verification completed");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function verifyIntegrity(req, res) {
  try {
    const report = await tenderService.verifyIntegrityChain();
    return ok(res, { report }, "Integrity verification completed");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}


module.exports = {
  createTender,
  getAllTenders,
  getOpenTenders,
  getAwardedTenders,
  getTendersWithApprovedBids,
  getTenderById,
  selectWinner,
  verifyIntegrity,
  verifyTenderIntegrity,
};