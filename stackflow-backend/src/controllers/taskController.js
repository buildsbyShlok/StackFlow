import Task from "../models/Task.js";
import Milestone from "../models/Milestone.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { requireValue, text, dueDate } from "../lib/errors.js";
import { canReview, validateTransition } from "../lib/workflow.js";
import { workspace } from "../lib/workspace.js";
import { withProjectMutation } from "../lib/lifecycle.js";
async function ownedMilestone(milestoneId, user) {
  const milestone = await Milestone.findOne({
    _id: milestoneId,
    orgId: user.orgId
  });
  requireValue(milestone && (await Project.exists({
    _id: milestone.projectId,
    orgId: user.orgId
  })), 404, "Milestone not found.");
  return milestone;
}
function metadata(body) {
  const priority = body.priority || "medium";
  requireValue(["low", "medium", "high", "urgent"].includes(priority), 400, "Choose a valid priority.");
  return {
    title: text(body.title, "Task title"),
    description: text(body.description, "Description", 10000, true),
    dueDate: dueDate(body.dueDate),
    priority
  };
}
async function assignee(email, orgId) {
  const user = await User.findOne({
    email: text(email, "Assignee email", 254).toLowerCase(),
    orgId,
    role: "teammate"
  }).collation({
    locale: "en",
    strength: 2
  });
  requireValue(user, 400, "Choose a teammate in this workspace.");
  return user;
}
export async function createTask(req, res) {
  const milestone = await ownedMilestone(req.params.milestoneId, req.user);
  requireValue(canReview(req.user, milestone), 403, "Only this milestone's Tech Lead or an Admin can create tasks.");
  const fields = metadata(req.body);
  const member = await assignee(req.body.assignedToEmail, req.user.orgId);
  const task = await withProjectMutation(milestone.projectId, req.user.orgId, async (_, session) => {
    const current = await Milestone.findById(milestone._id).session(session || null);
    requireValue(current, 404, "Milestone not found.");
    requireValue(canReview(req.user, current), 403, "Milestone ownership changed. Refresh and try again.");
    const [created] = await Task.create([{
      ...fields,
      milestoneId: milestone._id,
      assignedTo: member._id,
      orgId: req.user.orgId,
      createdBy: req.user.id,
      history: [{
        action: "created",
        to: "pending",
        actorId: req.user.id,
        actorName: req.user.name,
        at: new Date()
      }]
    }], {
      session
    });
    await Milestone.updateOne({
      _id: milestone._id
    }, {
      $addToSet: {
        tasks: created._id
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
    task
  });
}
export async function getTasksForMilestone(req, res) {
  await ownedMilestone(req.params.milestoneId, req.user);
  const data = await workspace(req.user.orgId, req.user);
  res.json({
    tasks: data.tasks.filter(t => String(t.milestoneId) === req.params.milestoneId)
  });
}
export async function getTaskById(req, res) {
  const task = await Task.findOne({
    _id: req.params.taskId,
    orgId: req.user.orgId
  }).lean();
  requireValue(task, 404, "Task not found.");
  await ownedMilestone(task.milestoneId, req.user);
  const data = await workspace(req.user.orgId, req.user);
  res.json({
    task: {
      ...data.tasks.find(t => String(t._id) === req.params.taskId),
      history: task.history || []
    }
  });
}
export const transitionTask = action => async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.taskId,
    orgId: req.user.orgId
  });
  requireValue(task, 404, "Task not found.");
  const milestone = await ownedMilestone(task.milestoneId, req.user);
  const reason = text(req.body.reason, "Review reason", 2000, true);
  const rule = validateTransition(action, task, milestone, req.user, reason);
  const version = task.__v || 0;
  requireValue(req.body.version === undefined || req.body.version === version, 409, "This task changed. Refresh and try again.");
  const now = new Date();
  const fields = {
    status: rule.to
  };
  if (rule.to === "completed") fields.completedAt = now;
  if (!rule.owner) Object.assign(fields, {
    reviewedBy: req.user.id,
    reviewedAt: now,
    reviewReason: reason,
    verifiedAt: rule.to === "verified" ? now : null
  });
  const updated = await Task.findOneAndUpdate({
    _id: task._id,
    orgId: req.user.orgId,
    status: task.status,
    __v: task.__v
  }, {
    $set: fields,
    $inc: {
      __v: 1
    },
    $push: {
      history: {
        action,
        from: task.status,
        to: rule.to,
        actorId: req.user.id,
        actorName: req.user.name,
        at: now,
        reason
      }
    }
  }, {
    new: true,
    runValidators: true
  });
  requireValue(updated, 409, "Another update won. Refresh and try again.");
  res.json({
    task: updated,
    message: "Task updated."
  });
};
export async function updateTask(req, res) {
  const task = await Task.findOne({
    _id: req.params.taskId,
    orgId: req.user.orgId
  });
  requireValue(task, 404, "Task not found.");
  const milestone = await ownedMilestone(task.milestoneId, req.user);
  requireValue(canReview(req.user, milestone), 403, "Only the assigned Tech Lead or Admin can edit this task.");
  requireValue(["pending", "in_progress", "changes_requested"].includes(task.status), 409, "Withdraw or reopen review before editing submitted work.");
  requireValue(req.body.version === (task.__v || 0), 409, "This task changed. Refresh and try again.");
  const member = await assignee(req.body.assignedToEmail, req.user.orgId);
  const updated = await Task.findOneAndUpdate({
    _id: task._id,
    orgId: req.user.orgId,
    __v: task.__v,
    status: task.status
  }, {
    $set: {
      ...metadata(req.body),
      assignedTo: member._id
    },
    $inc: {
      __v: 1
    },
    $push: {
      history: {
        action: "edited",
        actorId: req.user.id,
        actorName: req.user.name,
        at: new Date(),
        reason: "Task information or assignment updated."
      }
    }
  }, {
    new: true,
    runValidators: true
  });
  requireValue(updated, 409, "This task changed. Refresh and try again.");
  res.json({
    task: updated
  });
}
export async function deleteTask(req, res) {
  const task = await Task.findOne({
    _id: req.params.taskId,
    orgId: req.user.orgId
  });
  requireValue(task, 404, "Task not found.");
  const milestone = await ownedMilestone(task.milestoneId, req.user);
  requireValue(canReview(req.user, milestone), 403, "Only the assigned Tech Lead or Admin can delete a task.");
  requireValue(task.status === "pending" && !task.reviewedAt && !task.completedAt && !task.history?.some(event => !["created", "edited"].includes(event.action)), 409, "Only tasks that have not started can be deleted.");
  await withProjectMutation(milestone.projectId, req.user.orgId, async (_, session) => {
    const result = await Task.deleteOne({
      _id: task._id,
      orgId: req.user.orgId,
      status: "pending",
      __v: task.__v
    }, {
      session
    });
    requireValue(result.deletedCount, 409, "This task changed. Refresh and try again.");
    await Milestone.updateOne({
      _id: milestone._id
    }, {
      $pull: {
        tasks: task._id
      },
      $inc: {
        __v: 1
      }
    }, {
      session
    });
  });
  res.status(204).end();
}
