const { pool } = require("../db");
const { generateTenderNo } = require("../utils/tenderNo");
const { buildIntegrityBlock, verifyIntegrityBlock } = require("../utils/blockchain");

function toBlockArray(chainProofValue) {
  if (!chainProofValue) return [];

  let parsed = chainProofValue;
  if (typeof chainProofValue === "string") {
    try {
      parsed = JSON.parse(chainProofValue);
    } catch (_) {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    return [parsed];
  }

  return [];
}

async function getLatestLedgerHash() {
  const [rows] = await pool.query(
    `SELECT tx_hash
     FROM tenders
     WHERE tx_hash IS NOT NULL AND tx_hash != ''
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`
  );

  return rows[0]?.tx_hash || null;
}

function validateTenderInput(data) {
  const requiredFields = [
    "title_ar",
    "title_en",
    "agency_ar",
    "agency_en",
    "category_ar",
    "category_en",
    "location_ar",
    "location_en",
    "desc_ar",
    "desc_en",
    "deadline",
  ];

  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === "") {
      throw new Error(`${field} is required`);
    }
  }

  const allowedStatuses = ["open", "closed", "awarded"];
  if (data.status && !allowedStatuses.includes(data.status)) {
    throw new Error("Invalid tender status");
  }
}

function normalizeChainProofStorageError(error) {
  const isChainProofTooLong =
    error?.code === "ER_DATA_TOO_LONG" &&
    typeof error?.message === "string" &&
    error.message.includes("chain_proof");

  if (isChainProofTooLong) {
    throw new Error(
      "Blockchain proof is larger than DB column size. Run: ALTER TABLE tenders MODIFY COLUMN chain_proof LONGTEXT NULL;"
    );
  }

  throw error;
}

async function createTender(data, userId) {
  validateTenderInput(data);

  const tenderNo = generateTenderNo();
  const status = data.status || "open";

  const attachmentsJson = data.attachments_json
    ? JSON.stringify(data.attachments_json)
    : null;

  const [result] = await pool.query(
    `INSERT INTO tenders
    (
      tender_no, status,
      title_ar, title_en,
      agency_ar, agency_en,
      category_ar, category_en,
      location_ar, location_en,
      desc_ar, desc_en,
      deadline, attachments_json,
      chain_proof, tx_hash, event_type,
      winner_company_name_ar, winner_company_name_en,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenderNo,
      status,
      data.title_ar,
      data.title_en,
      data.agency_ar,
      data.agency_en,
      data.category_ar,
      data.category_en,
      data.location_ar,
      data.location_en,
      data.desc_ar,
      data.desc_en,
      data.deadline,
      attachmentsJson,
      null,
      null,
      null,
      data.winner_company_name_ar || null,
      data.winner_company_name_en || null,
      userId,
    ]
  );

  const tenderId = result.insertId;
  const previousHash = await getLatestLedgerHash();

  const creationBlock = buildIntegrityBlock({
    eventType: "tender_created",
    prevHash: previousHash,
    payload: {
      tender_id: tenderId,
      tender_no: tenderNo,
      title_ar: data.title_ar,
      title_en: data.title_en,
      agency_ar: data.agency_ar,
      agency_en: data.agency_en,
      category_ar: data.category_ar,
      category_en: data.category_en,
      location_ar: data.location_ar,
      location_en: data.location_en,
      deadline: data.deadline,
      created_by: userId,
    },
  });

  try {
    await pool.query(
      `UPDATE tenders
       SET chain_proof = ?, tx_hash = ?, event_type = ?
       WHERE id = ?`,
      [
        JSON.stringify([creationBlock]),
        creationBlock.block_hash,
        creationBlock.event_type,
        tenderId,
      ]
    );
  } catch (error) {
    normalizeChainProofStorageError(error);
  }

  const [rows] = await pool.query(
    `SELECT * FROM tenders WHERE id = ? LIMIT 1`,
    [tenderId]
  );

  return rows[0];
}

async function getAllTenders() {
  const [rows] = await pool.query(
    `SELECT * FROM tenders ORDER BY created_at DESC`
  );
  return rows;
}

async function getOpenTenders() {
  const [rows] = await pool.query(
    `SELECT * FROM tenders WHERE status = 'open' ORDER BY created_at DESC`
  );
  return rows;
}

async function getAwardedTenders() {
  const [rows] = await pool.query(
    `SELECT * FROM tenders WHERE status = 'awarded' ORDER BY created_at DESC`
  );
  return rows;
}

async function getTendersWithApprovedBids() {
  const [rows] = await pool.query(
    `SELECT DISTINCT t.*
     FROM tenders t
     JOIN bids b ON b.tender_id = t.id
     WHERE t.status = 'open'
       AND b.audit_status = 'approved'
     ORDER BY t.created_at DESC`
  );

  return rows;
}

async function selectWinner(tenderId, bidId, officerUserId) {
  // check tender exists
  const [tenders] = await pool.query(
    `SELECT * FROM tenders WHERE id = ? LIMIT 1`,
    [tenderId]
  );

  const tender = tenders[0];

  if (!tender) {
    throw new Error("Tender not found");
  }

  if (tender.status === "awarded") {
    throw new Error("Winner already selected");
  }

  // ✅ get bid
  const [bids] = await pool.query(
    `SELECT * FROM bids WHERE id = ? LIMIT 1`,
    [bidId]
  );

  const bid = bids[0];

  if (!bid) {
    throw new Error("Bid not found");
  }

  if (Number(bid.tender_id) !== Number(tenderId)) {
    throw new Error("Bid does not belong to this tender");
  }

  // 🔥 IMPORTANT FIX
  if (bid.audit_status !== "approved") {
    throw new Error("Only approved bids can be selected");
  }

  // mark selected bid as winner and clear previous winner flags for this tender
  await pool.query(
    `UPDATE bids SET is_winner = 0 WHERE tender_id = ?`,
    [tenderId]
  );

  await pool.query(
    `UPDATE bids SET is_winner = 1 WHERE id = ?`,
    [bidId]
  );

  const previousHash = await getLatestLedgerHash();
  const awardBlock = buildIntegrityBlock({
    eventType: "winner_selected",
    prevHash: previousHash,
    payload: {
      tender_id: Number(tenderId),
      tender_no: tender.tender_no,
      bid_id: bid.id,
      company_id: bid.company_id,
      company_name: bid.company_name,
      amount: bid.amount,
      duration_days: bid.duration_days,
      selected_by: officerUserId || null,
    },
  });

  const existingChain = toBlockArray(tender.chain_proof);
  const updatedChain = [...existingChain, awardBlock];

  // update tender
  try {
    await pool.query(
      `UPDATE tenders
       SET status = 'awarded',
           winner_company_name_ar = ?,
           winner_company_name_en = ?,
           chain_proof = ?,
           tx_hash = ?,
           event_type = ?
       WHERE id = ?`,
      [
        bid.company_name,
        bid.company_name,
        JSON.stringify(updatedChain),
        awardBlock.block_hash,
        awardBlock.event_type,
        tenderId,
      ]
    );
  } catch (error) {
    normalizeChainProofStorageError(error);
  }

  return { success: true };
}

async function getTenderById(id) {
  const [rows] = await pool.query(
    `SELECT * FROM tenders WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function verifyIntegrityChain() {
  const [rows] = await pool.query(
    `SELECT id, tender_no, chain_proof, tx_hash, event_type
     FROM tenders
     WHERE chain_proof IS NOT NULL AND chain_proof != ''
     ORDER BY id ASC`
  );

  const issues = [];
  const blocks = [];
  const globalBlocks = [];

  for (const tender of rows) {
    const chainBlocks = toBlockArray(tender.chain_proof);

    for (let i = 0; i < chainBlocks.length; i += 1) {
      globalBlocks.push({
        tender_id: tender.id,
        tender_no: tender.tender_no,
        index_in_tender_chain: i,
        block: chainBlocks[i],
        tender_tx_hash: tender.tx_hash,
        tender_event_type: tender.event_type,
        tender_chain_length: chainBlocks.length,
      });
    }
  }

  globalBlocks.sort((a, b) => {
    const ta = Date.parse(a.block?.timestamp || "");
    const tb = Date.parse(b.block?.timestamp || "");

    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
      return ta - tb;
    }

    if (a.tender_id !== b.tender_id) {
      return a.tender_id - b.tender_id;
    }

    return a.index_in_tender_chain - b.index_in_tender_chain;
  });

  let previousBlockHash = null;

  for (let i = 0; i < globalBlocks.length; i += 1) {
    const entry = globalBlocks[i];
    const block = entry.block;
    const blockCheck = verifyIntegrityBlock(block);
    const blockIssues = [...blockCheck.issues];

    const expectedPrevHash = previousBlockHash || "GENESIS";
    if (block?.prev_hash !== expectedPrevHash) {
      blockIssues.push(
        `prev_hash mismatch (expected ${expectedPrevHash}, got ${block?.prev_hash || "<missing>"})`
      );
    }

    const isLastBlockForTender =
      entry.index_in_tender_chain === entry.tender_chain_length - 1;

    if (isLastBlockForTender) {
      if (entry.tender_tx_hash && block?.block_hash && entry.tender_tx_hash !== block.block_hash) {
        blockIssues.push("tender tx_hash mismatch with latest chain block");
      }

      if (
        entry.tender_event_type &&
        block?.event_type &&
        entry.tender_event_type !== block.event_type
      ) {
        blockIssues.push("tender event_type mismatch with latest chain block");
      }
    }

    const status = blockIssues.length === 0 ? "valid" : "invalid";

    blocks.push({
      tender_id: entry.tender_id,
      tender_no: entry.tender_no,
      index_in_tender_chain: entry.index_in_tender_chain,
      event_type: block?.event_type || null,
      block_hash: block?.block_hash || null,
      prev_hash: block?.prev_hash || null,
      status,
    });

    if (blockIssues.length > 0) {
      issues.push({
        tender_id: entry.tender_id,
        tender_no: entry.tender_no,
        index_in_tender_chain: entry.index_in_tender_chain,
        block_hash: block?.block_hash || null,
        issues: blockIssues,
      });
    }

    previousBlockHash = block?.block_hash || previousBlockHash;
  }

  return {
    isValid: issues.length === 0,
    totalTendersWithProof: rows.length,
    totalBlocks: blocks.length,
    invalidBlocks: issues.length,
    headHash: previousBlockHash,
    issues,
    blocks,
  };
}

async function verifyTenderIntegrity(tenderId) {
  const [rows] = await pool.query(
    `SELECT id, tender_no, chain_proof, tx_hash, event_type
     FROM tenders
     WHERE id = ?
     LIMIT 1`,
    [tenderId]
  );

  const tender = rows[0];
  if (!tender) {
    throw new Error("Tender not found");
  }

  const chainBlocks = toBlockArray(tender.chain_proof);

  if (chainBlocks.length === 0) {
    return {
      tenderId: tender.id,
      tenderNo: tender.tender_no,
      isValid: false,
      totalBlocks: 0,
      headHash: null,
      issues: [
        {
          index_in_tender_chain: -1,
          block_hash: null,
          issues: ["no integrity blocks recorded for this tender"],
        },
      ],
    };
  }

  const issues = [];
  let previousBlockHash = null;

  for (let i = 0; i < chainBlocks.length; i += 1) {
    const block = chainBlocks[i];
    const blockCheck = verifyIntegrityBlock(block);
    const blockIssues = [...blockCheck.issues];

    // For a tender-local check, validate internal linkage only.
    // The first block may reference a previous GLOBAL ledger head, not necessarily GENESIS.
    if (i > 0) {
      const expectedPrevHash = previousBlockHash;
      if (block?.prev_hash !== expectedPrevHash) {
        blockIssues.push(
          `prev_hash mismatch (expected ${expectedPrevHash}, got ${block?.prev_hash || "<missing>"})`
        );
      }
    } else if (!block?.prev_hash) {
      blockIssues.push("missing prev_hash on first block");
    }

    if (blockIssues.length > 0) {
      issues.push({
        index_in_tender_chain: i,
        block_hash: block?.block_hash || null,
        issues: blockIssues,
      });
    }

    previousBlockHash = block?.block_hash || previousBlockHash;
  }

  if (chainBlocks.length > 0) {
    const latest = chainBlocks[chainBlocks.length - 1];

    if (tender.tx_hash && latest?.block_hash && tender.tx_hash !== latest.block_hash) {
      issues.push({
        index_in_tender_chain: chainBlocks.length - 1,
        block_hash: latest?.block_hash || null,
        issues: ["tender tx_hash mismatch with latest chain block"],
      });
    }

    if (tender.event_type && latest?.event_type && tender.event_type !== latest.event_type) {
      issues.push({
        index_in_tender_chain: chainBlocks.length - 1,
        block_hash: latest?.block_hash || null,
        issues: ["tender event_type mismatch with latest chain block"],
      });
    }
  }

  return {
    tenderId: tender.id,
    tenderNo: tender.tender_no,
    isValid: issues.length === 0,
    totalBlocks: chainBlocks.length,
    headHash: previousBlockHash,
    issues,
  };
}


module.exports = {
  createTender,
  getAllTenders,
  getOpenTenders,
  getAwardedTenders,
  getTendersWithApprovedBids,
  getTenderById,
  selectWinner,
  verifyIntegrityChain,
  verifyTenderIntegrity,
};