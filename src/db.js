const mysql = require("mysql2/promise");
const { db } = require("./config/env");

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function pingDB() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return true;
}

async function ensurePrototypeBlockchainSchema() {
  // Keep this idempotent so the prototype can self-heal across environments.
  await pool.query(
    `ALTER TABLE tenders MODIFY COLUMN chain_proof LONGTEXT NULL`
  );

  await pool.query(
    `ALTER TABLE tenders MODIFY COLUMN tx_hash VARCHAR(128) NULL`
  );

  await pool.query(
    `ALTER TABLE tenders MODIFY COLUMN event_type VARCHAR(64) NULL`
  );
}

module.exports = { pool, pingDB, ensurePrototypeBlockchainSchema };