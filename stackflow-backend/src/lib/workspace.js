import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { requireValue } from "./errors.js";
import { progress } from "./workflow.js";
export async function workspace(orgId, user) {
  const [org, projects, members] = await Promise.all([
    Organization.findById(orgId).select("name createdBy inviteCode").lean(),
    Project.find({ orgId }).sort({ createdAt: -1 }).lean(),
    User.find({ orgId })
      .select("name email role createdAt")
      .sort({ name: 1 })
      .lean(),
  ]);
  requireValue(org, 404, "Workspace not found.");
  if (user.role !== "admin") delete org.inviteCode;
  const milestones = await Milestone.find({
    orgId,
    projectId: { $in: projects.map((p) => p._id) },
  })
    .sort({ createdAt: 1 })
    .lean();
  const tasks = await Task.find({
    orgId,
    milestoneId: { $in: milestones.map((m) => m._id) },
  })
    .select("-history")
    .sort({ updatedAt: -1 })
    .lean();
  const users = new Map(members.map((m) => [String(m._id), m]));
  const milestoneMap = new Map(milestones.map((m) => [String(m._id), m]));
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));
  const enrichedTasks = tasks.map((t) => {
    const milestone = milestoneMap.get(String(t.milestoneId));
    const project = projectMap.get(String(milestone.projectId));
    return {
      ...t,
      assignedTo: users.get(String(t.assignedTo)) || null,
      project: { _id: project._id, name: project.name },
      milestone: {
        _id: milestone._id,
        title: milestone.title,
        assignedTo: String(milestone.assignedTo),
      },
      priority: t.priority || "medium",
      __v: t.__v || 0,
    };
  });
  const enrichedMilestones = milestones.map((m) => {
    const ownTasks = enrichedTasks.filter(
      (t) => String(t.milestoneId) === String(m._id),
    );
    return {
      ...m,
      assignedTo: users.get(String(m.assignedTo)) || null,
      tasks: ownTasks,
      ...progress(ownTasks),
    };
  });
  const enrichedProjects = projects.map((p) => {
    const ownMilestones = enrichedMilestones.filter(
      (m) => String(m.projectId) === String(p._id),
    );
    return {
      ...p,
      milestones: ownMilestones,
      ...progress(ownMilestones.flatMap((m) => m.tasks)),
    };
  });
  return {
    org: { ...org, members },
    projects: enrichedProjects,
    milestones: enrichedMilestones,
    tasks: enrichedTasks,
    members,
  };
}
