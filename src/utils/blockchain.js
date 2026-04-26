const crypto = require("crypto");

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function computePayloadHash(payload) {
  const normalizedPayload = canonicalize(payload);
  const payloadJson = JSON.stringify(normalizedPayload);
  return sha256(payloadJson);
}

function computeBlockHash(block) {
  const blockMaterial = JSON.stringify({
    version: block.version || 1,
    algorithm: block.algorithm || "SHA-256",
    event_type: block.event_type,
    prev_hash: block.prev_hash,
    payload_hash: block.payload_hash,
    timestamp: block.timestamp,
  });

  return sha256(blockMaterial);
}

function buildIntegrityBlock({ eventType, payload, prevHash, timestamp }) {
  const normalizedPayload = canonicalize(payload);
  const payloadHash = computePayloadHash(normalizedPayload);

  const blockTimestamp = timestamp || new Date().toISOString();
  const previousHash = prevHash || "GENESIS";

  const blockHash = computeBlockHash({
    version: 1,
    algorithm: "SHA-256",
    event_type: eventType,
    prev_hash: previousHash,
    payload_hash: payloadHash,
    timestamp: blockTimestamp,
  });

  return {
    version: 1,
    algorithm: "SHA-256",
    event_type: eventType,
    prev_hash: previousHash,
    payload_hash: payloadHash,
    timestamp: blockTimestamp,
    payload: normalizedPayload,
    block_hash: blockHash,
  };
}

function verifyIntegrityBlock(block) {
  const issues = [];

  if (!block || typeof block !== "object") {
    return { isValid: false, issues: ["block is not an object"] };
  }

  if (!block.event_type) issues.push("missing event_type");
  if (!block.prev_hash) issues.push("missing prev_hash");
  if (!block.payload_hash) issues.push("missing payload_hash");
  if (!block.timestamp) issues.push("missing timestamp");
  if (!block.block_hash) issues.push("missing block_hash");

  const recomputedBlockHash = computeBlockHash(block);
  if (block.block_hash !== recomputedBlockHash) {
    issues.push("block_hash mismatch");
  }

  if (block.payload !== undefined) {
    const recomputedPayloadHash = computePayloadHash(block.payload);
    if (block.payload_hash !== recomputedPayloadHash) {
      issues.push("payload_hash mismatch");
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

module.exports = {
  buildIntegrityBlock,
  verifyIntegrityBlock,
};
