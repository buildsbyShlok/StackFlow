import express from "express";
import {
  authenticateToken,
  requireOrg,
} from "../middlewares/authenticateToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { workspace } from "../lib/workspace.js";
const router = express.Router();
router.use(authenticateToken, requireOrg, authorizeRoles("admin", "techlead"));
router.get("/pending", async (req, res) => {
  const data = await workspace(req.user.orgId, req.user);
  const tasks = data.tasks
    .filter(
      (t) =>
        t.status === "completed" &&
        (req.user.role === "admin" || t.milestone.assignedTo === req.user.id),
    )
    .sort(
      (a, b) =>
        new Date(a.completedAt || a.updatedAt) -
        new Date(b.completedAt || b.updatedAt),
    );
  res.json({
    tasks,
    pendingCount: tasks.length,
    waiting: tasks,
    source: "mongodb",
  });
});
router.get("/stats", async (req, res) => {
  const data = await workspace(req.user.orgId, req.user);
  const tasks = data.tasks.filter(
    (t) => req.user.role === "admin" || t.milestone.assignedTo === req.user.id,
  );
  res.json({
    counts: {
      waiting: tasks.filter((t) => t.status === "completed").length,
      completed: tasks.filter((t) => t.status === "verified").length,
    },
    source: "mongodb",
  });
});
router.get("/failed", (req, res) =>
  res
    .status(410)
    .json({
      message:
        "Background auto-verification was retired. Reviews are persisted in MongoDB.",
    }),
);
export default router;
