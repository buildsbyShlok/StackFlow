import Milestone from "../models/Milestone.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { dueDate, text, requireValue } from "../lib/errors.js";
import { workspace } from "../lib/workspace.js";
import Task from "../models/Task.js";
import { withProjectMutation, confirmDeletion } from "../lib/lifecycle.js";
export async function createMilestone(req, res) {
  const project = await Project.findOne({
    _id: req.params.projectId,
    orgId: req.user.orgId
  });
  requireValue(project, 404, "Project not found.");
  const lead = await User.findOne({
    email: text(req.body.assignedToEmail, "Tech Lead email", 254).toLowerCase(),
    orgId: req.user.orgId,
    role: "techlead"
  }).collation({
    locale: "en",
    strength: 2
  });
  requireValue(lead, 400, "Choose a Tech Lead in this workspace.");
  requireValue(req.user.role === "admin" || String(lead._id) === req.user.id, 403, "Tech Leads can create milestones assigned to themselves.");
  const fields = {
    title: text(req.body.title, "Milestone title"),
    description: text(req.body.description, "Description", 5000, true),
    dueDate: dueDate(req.body.dueDate),
    projectId: project._id,
    assignedTo: lead._id,
    orgId: req.user.orgId
  };
  const milestone = await withProjectMutation(project._id, req.user.orgId, async (_, session) => {
    const [created] = await Milestone.create([fields], {
      session
    });
    // Reverse references are authoritative. Keep legacy arrays for existing integrations.
    await Project.updateOne({
      _id: project._id
    }, {
      $addToSet: {
        milestones: created._id
      },
      $inc: {
        __v: 1
      }
    }, {
      session
    });
    return created;
  });
  res.status(201).json({
    milestone
  });
}
export async function getMilestonesForProject(req, res) {
  requireValue(await Project.exists({
    _id: req.params.projectId,
    orgId: req.user.orgId
  }), 404, "Project not found.");
  const data = await workspace(req.user.orgId, req.user);
  res.json({
    milestones: data.milestones.filter(m => String(m.projectId) === req.params.projectId)
  });
}
export async function updateMilestone(req, res) {
  const current = await Milestone.findOne({
    _id: req.params.milestoneId,
    orgId: req.user.orgId
  });
  requireValue(current, 404, "Milestone not found.");
  const lead = await User.findOne({
    email: text(req.body.assignedToEmail, "Tech Lead email", 254).toLowerCase(),
    orgId: req.user.orgId,
    role: "techlead"
  }).collation({
    locale: "en",
    strength: 2
  });
  requireValue(lead, 400, "Choose a Tech Lead in this workspace.");
  const fields = {
    title: text(req.body.title, "Milestone title"),
    description: text(req.body.description, "Description", 5000, true),
    assignedTo: lead._id,
    dueDate: dueDate(req.body.dueDate)
  };
  const milestone = await withProjectMutation(current.projectId, req.user.orgId, async (_, session) => Milestone.findOneAndUpdate({
    _id: current._id,
    orgId: req.user.orgId
  }, {
    $set: fields,
    $inc: {
      __v: 1
    }
  }, {
    new: true,
    runValidators: true,
    session
  }));
  requireValue(milestone, 404, "Milestone not found.");
  res.json({
    milestone
  });
}
export async function deleteMilestone(req, res) {
  const current = await Milestone.findOne({
    _id: req.params.milestoneId,
    orgId: req.user.orgId
  });
  requireValue(current, 404, "Milestone not found.");
  await withProjectMutation(current.projectId, req.user.orgId, async (project, session) => {
    const milestone = await Milestone.findById(current._id).session(session || null);
    requireValue(milestone, 404, "Milestone not found.");
    confirmDeletion(req.body, milestone, milestone.title);
    requireValue(!(await Task.exists({
      milestoneId: milestone._id
    }).session(session || null)), 409, "This milestone contains tasks. Delete unstarted tasks individually first. Started tasks and verification history must be retained; this milestone cannot be deleted while they exist.");
    // Reverse references keep a milestone discoverable if standalone cleanup is interrupted.
    await Project.updateOne({
      _id: project._id
    }, {
      $pull: {
        milestones: milestone._id
      },
      $inc: {
        __v: 1
      }
    }, {
      session
    });
    await Milestone.deleteOne({
      _id: milestone._id,
      orgId: req.user.orgId
    }, {
      session
    });
  });
  res.status(204).end();
}
export async function getMilestoneById(req, res) {
  requireValue(await Milestone.exists({
    _id: req.params.milestoneId,
    orgId: req.user.orgId
  }), 404, "Milestone not found.");
  const data = await workspace(req.user.orgId, req.user);
  const milestone = data.milestones.find(m => String(m._id) === req.params.milestoneId);
  requireValue(milestone, 404, "Milestone not found.");
  res.json({
    milestone
  });
}
