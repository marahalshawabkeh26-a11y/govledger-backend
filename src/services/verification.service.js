const { pool } = require("../db");

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getExpiryDate(minutes = 10) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

async function createVerificationCode(userId, purpose) {
  const code = generateCode();
  const expiresAt = getExpiryDate(10);

  await pool.query(
    `INSERT INTO verification_codes (user_id, code, purpose, expires_at)
     VALUES (?, ?, ?, ?)`,
    [userId, code, purpose, expiresAt]
  );

  return code;
}

async function findValidCode(userId, code, purpose) {
  const [rows] = await pool.query(
    `SELECT * FROM verification_codes
     WHERE user_id = ? AND code = ? AND purpose = ? AND is_used = 0 AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [userId, code, purpose]
  );

  return rows[0] || null;
}

async function markCodeUsed(id) {
  await pool.query(
    `UPDATE verification_codes SET is_used = 1 WHERE id = ?`,
    [id]
  );
}

module.exports = {
  createVerificationCode,
  findValidCode,
  markCodeUsed,
};