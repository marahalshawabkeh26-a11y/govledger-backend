const authService = require("../services/auth.service");
const { ok, fail } = require("../utils/response");

async function signup(req, res, next) {
  try {
    const result = await authService.signup({
      ...req.body,
      company_certificate: req.file ? `/uploads/${req.file.filename}` : req.body.company_certificate,
    });
    return ok(res, result, "User created. Verification code sent.", 201);
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return ok(res, result, "Login code sent.");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

async function verifyCode(req, res, next) {
  try {
    const result = await authService.verifyCode(req.body);
    return ok(res, result, "Verification successful");
  } catch (error) {
    return fail(res, error.message, 400);
  }
}

module.exports = {
  signup,
  login,
  verifyCode,
};