import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { readConfig } from "./lib/config.js";
// Hosted production must use explicit service configuration, never local defaults.
if (process.env.NODE_ENV !== "production") dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
let config;
try {
  config = readConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
try {
  await mongoose.connect(process.env.DB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
} catch {
  console.error(
    "MongoDB connection failed. Check DB_URI and confirm MongoDB is running.",
  );
  process.exit(1);
}
const server = createApp(config).listen(config.port, "0.0.0.0", () =>
  console.log("StackFlow API listening on port " + config.port),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
