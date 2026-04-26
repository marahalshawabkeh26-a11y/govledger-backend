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

    app.listen(4000, '0.0.0.0', () => {
      console.log('Server running on http://0.0.0.0:4000');
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

start();