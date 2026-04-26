async function sendVerificationEmail(to, code, purpose) {
  console.log("Verification email event:");
  console.log("To:", to);
  console.log("Purpose:", purpose);
  console.log("Code:", code);
}

module.exports = { sendVerificationEmail };