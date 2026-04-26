const { pool } = require("../db");

function validateBidInput(data) {
  if (!data.tender_id || Number(data.tender_id) <= 0) {
    throw new Error("Valid tender_id is required");
  }

  if (!data.company_name || String(data.company_name).trim() === "") {
    throw new Error("company_name is required");
  }

  if (!data.amount || Number(data.amount) <= 0) {
    throw new Error("Valid amount is required");
  }

  if (!data.duration_days || Number(data.duration_days) <= 0) {
    throw new Error("Valid duration_days is required");
  }
}

async function getAllBids() {
  const [rows] = await pool.query(`
    SELECT 
      b.*,
      t.tender_no,
      t.title_ar,
      t.title_en
    FROM bids b
    JOIN tenders t ON b.tender_id = t.id
    ORDER BY b.created_at DESC
  `);

  return rows;
}

async function auditBid(bidId, action, auditorId) {
  const validActions = ["approved", "rejected", "flagged"];

  if (!validActions.includes(action)) {
    throw new Error("Invalid audit action");
  }

  const [rows] = await pool.query(
    `SELECT * FROM bids WHERE id = ? LIMIT 1`,
    [bidId]
  );

  const bid = rows[0];

  if (!bid) {
    throw new Error("Bid not found");
  }

  if (bid.audit_status === "approved") {
    throw new Error("Bid already approved");
  }

  if (bid.audit_status === "rejected") {
    throw new Error("Bid already rejected");
  }

  await pool.query(
    `UPDATE bids
     SET audit_status = ?, audited_by = ?, audited_at = NOW()
     WHERE id = ?`,
    [action, auditorId, bidId]
  );

  const [updated] = await pool.query(
    `SELECT * FROM bids WHERE id = ? LIMIT 1`,
    [bidId]
  );

  return updated[0];
}

async function getApprovedBidsByTender(tenderId) {
  const [rows] = await pool.query(`
    SELECT 
      b.*,
      u.email,
      u.id as user_id
    FROM bids b
    JOIN users u ON b.company_id = u.id
    WHERE b.tender_id = ?
      AND b.audit_status = 'approved'
  `, [tenderId]);

  return rows;
}

async function submitBid(data, companyUserId) {
  validateBidInput(data);

  const tenderId = Number(data.tender_id);

  const [tenderRows] = await pool.query(
    `SELECT * FROM tenders WHERE id = ? LIMIT 1`,
    [tenderId]
  );

  const tender = tenderRows[0];
  if (!tender) {
    throw new Error("Tender not found");
  }

  if (tender.status !== "open") {
    throw new Error("Bids can only be submitted to open tenders");
  }

  const today = new Date().toISOString().split("T")[0];
  if (tender.deadline < today) {
    throw new Error("Tender deadline has passed");
  }

  const filesJson = data.files ? JSON.stringify(data.files) : null;

  const [result] = await pool.query(
    `INSERT INTO bids
    (
      tender_id, company_id, company_name, amount, duration_days, notes, files
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenderId,
      companyUserId,
      data.company_name,
      Number(data.amount),
      Number(data.duration_days),
      data.notes || null,
      filesJson,
    ]
  );

  const [rows] = await pool.query(
    `SELECT * FROM bids WHERE id = ? LIMIT 1`,
    [result.insertId]
  );

  return rows[0];
}

async function getMyBids(companyUserId) {
  const [rows] = await pool.query(
    `SELECT
      b.*,
      t.tender_no,
      t.title_ar,
      t.title_en,
      t.deadline
     FROM bids b
     JOIN tenders t ON b.tender_id = t.id
     WHERE b.company_id = ?
     ORDER BY b.created_at DESC`,
    [companyUserId]
  );

  return rows;
}

module.exports = {
  submitBid,
  getMyBids,
  auditBid,
  getAllBids,
  getApprovedBidsByTender,

};