function ok(res, data = {}, message = "Success", status = 200) {
  return res.status(status).json({ message, ...data });
}

function fail(res, message = "Error", status = 400) {
  return res.status(status).json({ message });
}

module.exports = { ok, fail };