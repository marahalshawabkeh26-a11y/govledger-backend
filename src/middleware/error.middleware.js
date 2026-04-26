module.exports = function errorMiddleware(err, req, res, next) {
  console.error(err);

  if (err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      message: "File too large. Maximum allowed size is 25 MB per file.",
    });
  }

  return res.status(500).json({
    message: err.message || "Internal server error",
  });
};