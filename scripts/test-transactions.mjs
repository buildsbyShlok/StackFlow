import { spawn } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose from "mongoose";
import net from "node:net";

// Separate disposable replica set; never reconfigure the application's MongoDB.
const binary = process.env.MONGOD_BINARY || "C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe";
const probe = net.createServer();
await new Promise((done, fail) => {
  probe.once("error", fail);
  probe.listen(0, "127.0.0.1", done);
});
const port = probe.address().port;
await new Promise(done => probe.close(done));
await mkdir(".artifacts", {
  recursive: true
});
const directory = await mkdtemp(resolve(".artifacts/replica-"));
const uri = `mongodb://127.0.0.1:${port}`;
const mongod = spawn(binary, ["--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "stackflow_quality", "--logpath", resolve(directory, "mongod.log")], {
  windowsHide: true,
  stdio: "ignore"
});
let launchError;
mongod.on("error", error => {
  launchError = error;
});
let client;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (launchError) throw launchError;
    try {
      client = new mongoose.mongo.MongoClient(uri, {
        directConnection: true,
        serverSelectionTimeoutMS: 500
      });
      await client.connect();
      break;
    } catch {
      await client?.close();
      client = null;
      await new Promise(done => setTimeout(done, 500));
    }
  }
  if (!client) throw new Error("Disposable mongod did not start. Check MONGOD_BINARY.");
  await client.db("admin").command({
    replSetInitiate: {
      _id: "stackflow_quality",
      members: [{
        _id: 0,
        host: `127.0.0.1:${port}`
      }]
    }
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if ((await client.db("admin").command({
      hello: 1
    })).isWritablePrimary) {
      ready = true;
      break;
    }
    await new Promise(done => setTimeout(done, 500));
  }
  if (!ready) throw new Error("Replica set election did not complete.");
  console.log("Testing transaction branch with disposable replica set.");
  const child = spawn(process.execPath, ["--test", "stackflow-backend/test/integration.test.js"], {
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_MONGO_URI: uri + "/?replicaSet=stackflow_quality"
    }
  });
  process.exitCode = await new Promise((done, fail) => {
    child.once("error", fail);
    child.once("exit", code => done(code ?? 1));
  });
} finally {
  if (client) {
    try {
      await client.db("admin").command({
        shutdown: 1
      });
    } catch {/* A successful shutdown closes the connection. */}
    await client.close();
  }
  if (mongod.exitCode === null) mongod.kill();
  console.log("Disposable replica files retained for diagnostics at " + directory);
}
