const { pool } = require("../db");
const { hashPassword, comparePassword } = require("../utils/hash");
const { signToken } = require("../utils/jwt");
const {
  createVerificationCode,
  findValidCode,
  markCodeUsed,
} = require("./verification.service");
const { sendVerificationEmail } = require("./email.service");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(password);
}

function validateSignupInput(data) {
  if (!data.email || !isValidEmail(data.email)) {
    throw new Error("Please enter a valid email address");
  }

  if (!data.password || !isStrongPassword(data.password)) {
    throw new Error(
      "Password must be at least 8 characters and include an uppercase letter, a number, and a special symbol"
    );
  }

  if (!data.role || !["officer", "company", "auditor"].includes(data.role)) {
    throw new Error("Invalid role");
  }

  if (data.role === "officer") {
    if (!data.employee_id || !data.department) {
      throw new Error("Officer must provide employee ID and department");
    }
  }

  if (data.role === "company") {
    if (!data.company_id || !data.business_type || !data.phone) {
      throw new Error("Company must provide company ID, business type, and phone");
    }
  }

  if (data.role === "auditor") {
    if (!data.license_id || !data.firm_name) {
      throw new Error("Auditor must provide license ID and firm name");
    }
  }
}

function validateLoginInput(data) {
  if (!data.email || !isValidEmail(data.email)) {
    throw new Error("Please enter a valid email address");
  }

  if (!data.password) {
    throw new Error("Password is required");
  }
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, email, role, is_verified FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function signup(data) {
  validateSignupInput(data);
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    throw new Error("Email already exists");
  }

  const passwordHash = await hashPassword(data.password);

  const [result] = await pool.query(
    `INSERT INTO users
    (email, password_hash, role, employee_id, department, company_id, business_type, phone, company_certificate, license_id, firm_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.email,
      passwordHash,
      data.role,
      data.employee_id || null,
      data.department || null,
      data.company_id || null,
      data.business_type || null,
      data.phone || null,
      data.company_certificate || null,
      data.license_id || null,
      data.firm_name || null,
    ]
  );

  const userId = result.insertId;
  const code = await createVerificationCode(userId, "signup");
  await sendVerificationEmail(data.email, code, "signup");

  return { userId };
}

async function login(data) {
  validateLoginInput(data);
  const user = await findUserByEmail(data.email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordOk = await comparePassword(data.password, user.password_hash);
  if (!passwordOk) {
    throw new Error("Invalid email or password");
  }

  const code = await createVerificationCode(user.id, "login");
  await sendVerificationEmail(user.email, code, "login");

  return { userId: user.id };
}

async function verifyCode(data) {
  const user = await findUserByEmail(data.email);
  if (!user) {
    throw new Error("User not found");
  }

  const record = await findValidCode(user.id, data.code, data.purpose);
  if (!record) {
    throw new Error("Invalid or expired code");
  }

  await markCodeUsed(record.id);

  if (data.purpose === "signup") {
    await pool.query(
      `UPDATE users SET is_verified = 1 WHERE id = ?`,
      [user.id]
    );
  }

  const safeUser = await findUserById(user.id);
  const token = signToken({
    id: safeUser.id,
    email: user.email,
    role: user.role,
  });

  return { token, user: safeUser };
}

module.exports = {
  signup,
  login,
  verifyCode,
  findUserByEmail,
};