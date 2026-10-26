import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readConfig } from "../src/lib/config.js";
import { createApp } from "../src/app.js";
import { cookieOptions } from "../src/lib/session.js";

const production = () => ({
  NODE_ENV: "production",
  DB_URI: "mongodb+srv://cluster.example.mongodb.net/stackflow",
  ACCESS_SECRET: randomBytes(32).toString("hex"),
  REFRESH_SECRET: randomBytes(32).toString("hex"),
  FRONTEND_URL: "https://app.example.com",
  PORT: "10000",
  TRUST_PROXY: "1",
});

test("production accepts explicit Atlas, origins, secrets and Render port", () => {
  assert.deepEqual(readConfig(production()), {
    port: 10000, trustProxy: 1, origins: ["https://app.example.com"],
  });
});

test("production rejects local databases, missing database and disabled TLS", () => {
  for (const DB_URI of ["mongodb://127.0.0.1:27017/stackflow", "mongodb+srv://localhost/stackflow",
    "mongodb+srv://cluster.example.mongodb.net", "mongodb+srv://cluster.example.mongodb.net/admin",
    "mongodb+srv://cluster.example.mongodb.net/stackflow?tls=false",
    "mongodb+srv://cluster.example.mongodb.net/stackflow?tlsAllowInvalidCertificates=true"]) {
    assert.throws(() => readConfig({ ...production(), DB_URI }), /Production DB_URI/);
  }
});

test("production rejects missing or unsafe configuration without disclosing it", () => {
  for (const key of ["DB_URI", "ACCESS_SECRET", "REFRESH_SECRET", "FRONTEND_URL"]) {
    const env = production(); delete env[key];
    assert.throws(() => readConfig(env), new RegExp(key));
  }
  for (const FRONTEND_URL of ["*", "http://app.example.com", "https://app.example.com/", "https://localhost", "https://app.example.com/path"]) {
    assert.throws(() => readConfig({ ...production(), FRONTEND_URL }), /FRONTEND_URL/);
  }
  assert.throws(() => readConfig({ ...production(), PORT: "invalid" }), /PORT/);
  assert.throws(() => readConfig({ ...production(), TRUST_PROXY: "true" }), /TRUST_PROXY/);
  const env = production(); env.REFRESH_SECRET = env.ACCESS_SECRET;
  assert.throws(() => readConfig(env), /must be different/);
});

test("local development remains supported", () => {
  const env = { ...production(), NODE_ENV: "development", DB_URI: "mongodb://127.0.0.1:27017/stackflow" };
  delete env.FRONTEND_URL; delete env.TRUST_PROXY; delete env.PORT;
  assert.deepEqual(readConfig(env), { port: 5000, trustProxy: 0, origins: ["http://localhost:5173"] });
});

test("production startup cannot load the local .env as a fallback", () => {
  const env = { ...process.env, NODE_ENV: "production" };
  for (const key of ["DB_URI", "ACCESS_SECRET", "REFRESH_SECRET"]) delete env[key];
  const result = spawnSync(process.execPath, ["stackflow-backend/src/server.js"], {
    env, encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing required environment variable: DB_URI/);
});

test("production HTTP protects origins and uses secure same-site refresh cookies", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const server = createApp(readConfig(production())).listen(0, "127.0.0.1");
  try {
    await new Promise(resolve => server.once("listening", resolve));
    assert.deepEqual(cookieOptions(), { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth" });
    const base = `http://127.0.0.1:${server.address().port}`;
    const blocked = await fetch(base + "/api/health", { headers: { Origin: "https://untrusted.example" } });
    assert.equal(blocked.status, 403);
    const allowed = await fetch(base + "/api/health", { headers: { Origin: "https://app.example.com" } });
    assert.equal(allowed.status, 503); // This test deliberately does not connect a database.
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example.com");
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    const preflight = await fetch(base + "/api/auth/login", {
      method: "OPTIONS", headers: { Origin: "https://app.example.com", "Access-Control-Request-Method": "POST" },
    });
    assert.equal(preflight.status, 204);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
