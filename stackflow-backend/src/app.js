import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import milestoneRoutes from "./routes/milestoneRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import orgRoutes from "./routes/orgRoutes.js";
import queueRoutes from "./routes/queueRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import { errorHandler } from "./lib/errors.js";
import {
  authenticateToken,
  requireOrg,
} from "./middlewares/authenticateToken.js";
import { workspace } from "./lib/workspace.js";
import { readHttpConfig } from "./lib/config.js";

export function createApp(config = readHttpConfig()) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  const origins = config.origins;
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (req.headers.origin && !origins.includes(req.headers.origin))
      return res.status(403).json({ message: "Origin is not allowed." });
    next();
  });
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });
  app.use(cookieParser());
  // Small, process-local login limiter. A multi-instance deployment should use a shared limiter.
  const attempts = new Map();
  app.use("/api/auth", (req, res, next) => {
    if (!["/login", "/register", "/password"].includes(req.path) || req.method !== "POST")
      return next();
    const now = Date.now();
    for (const [key, entry] of attempts)
      if (entry.until < now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 60000 };
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > 30) {
      res.setHeader("Retry-After", "60");
      return res
        .status(429)
        .json({ message: "Too many attempts. Wait a minute and try again." });
    }
    next();
  });
  app.get("/api/health", (req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status:
        mongoose.connection.readyState === 1 ? "ready" : "database_unavailable",
    }),
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/milestones", milestoneRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/org", orgRoutes);
  app.use("/api/queue", queueRoutes);
  app.use("/api/search", searchRoutes);
  app.get("/api/workspace", authenticateToken, requireOrg, async (req, res) =>
    res.json(await workspace(req.user.orgId, req.user)),
  );
  app.use((req, res) => res.status(404).json({ message: "Route not found." }));
  app.use(errorHandler);
  return app;
}
