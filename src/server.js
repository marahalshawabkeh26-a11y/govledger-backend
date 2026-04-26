const app = require("./app");
const { port } = require("./config/env");
const { pingDB, ensurePrototypeBlockchainSchema } = require("./db");

async function start() {
  try {
    await pingDB();
    console.log("Database connected successfully");

    try {
      await ensurePrototypeBlockchainSchema();
      console.log("Blockchain schema verified");
    } catch (schemaError) {
      console.warn(
        "Could not auto-upgrade blockchain schema:",
        schemaError.message
      );
    }

    const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }

  app.get("/health", async (req, res) => {
  try {
    await pingDB(); // or your DB check function
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "failed" });
  }
});
app.get("/health", (req, res) => {
  res.send("Server is working ✅");
});
}

start();