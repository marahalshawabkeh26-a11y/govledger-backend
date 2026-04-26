const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth.routes");
const errorMiddleware = require("./middleware/error.middleware");
const tenderRoutes = require("./routes/tender.routes");
const bidRoutes = require("./routes/bid.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", async (req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/bids", bidRoutes);

app.use(errorMiddleware);

module.exports = app;