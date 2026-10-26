import express from "express";
import {
  authenticateToken,
  requireOrg,
} from "../middlewares/authenticateToken.js";
import { workspace } from "../lib/workspace.js";
const router = express.Router();
router.get("/", authenticateToken, requireOrg, async (req, res) => {
  const q =
    typeof req.query.q === "string"
      ? req.query.q.trim().slice(0, 80).toLowerCase()
      : "";
  if (q.length < 2)
    return res.json({ projects: [], milestones: [], tasks: [], people: [] });
  const data = await workspace(req.user.orgId, req.user);
  const matches = (value) => value.toLowerCase().includes(q);
  res.json({
    projects: data.projects
      .filter((p) => matches(p.name))
      .slice(0, 5)
      .map((p) => ({
        id: p._id,
        title: p.name,
        subtitle: "Project",
        url: "/projects/" + p._id,
      })),
    milestones: data.milestones
      .filter((m) => matches(m.title))
      .slice(0, 5)
      .map((m) => ({
        id: m._id,
        title: m.title,
        subtitle: "Milestone",
        url: "/tasks/" + m._id,
      })),
    tasks: data.tasks
      .filter((t) => matches(t.title))
      .slice(0, 7)
      .map((t) => ({
        id: t._id,
        title: t.title,
        subtitle: t.project.name,
        url: "/tasks/details/" + t._id,
      })),
    people: data.members
      .filter((m) => matches(m.name + " " + m.email))
      .slice(0, 5)
      .map((m) => ({
        id: m._id,
        title: m.name,
        subtitle: m.role,
        url: "/team?member=" + m._id,
      })),
  });
});
export default router;
