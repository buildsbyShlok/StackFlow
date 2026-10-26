import Project from "../models/Project.js";
import { text, requireValue } from "../lib/errors.js";
import { workspace } from "../lib/workspace.js";
import Milestone from "../models/Milestone.js";
import { withProjectMutation, confirmDeletion } from "../lib/lifecycle.js";
export async function createProject(req, res) {
  const name = text(req.body.name, "Project name", 120);
  const description = text(req.body.description, "Description", 5000, true);
  const project = await Project.create({
    name,
    description,
    createdBy: req.user.id,
    orgId: req.user.orgId
  });
  res.status(201).json({
    project
  });
}
export async function getAllProjects(req, res) {
  const data = await workspace(req.user.orgId, req.user);
  res.json({
    projects: data.projects
  });
}
export async function getProjectById(req, res) {
  requireValue(await Project.exists({
    _id: req.params.projectId,
    orgId: req.user.orgId
  }), 404, "Project not found.");
  const data = await workspace(req.user.orgId, req.user);
  res.json({
    project: data.projects.find(p => String(p._id) === req.params.projectId)
  });
}
export async function updateProject(req, res) {
  const project = await withProjectMutation(req.params.projectId, req.user.orgId, async (_, session) => Project.findOneAndUpdate({
    _id: req.params.projectId,
    orgId: req.user.orgId
  }, {
    $set: {
      name: text(req.body.name, "Project name", 120),
      description: text(req.body.description, "Description", 5000, true)
    },
    $inc: {
      __v: 1
    }
  }, {
    new: true,
    runValidators: true,
    session
  }));
  requireValue(project, 404, "Project not found.");
  res.json({
    project
  });
}
export async function deleteProject(req, res) {
  await withProjectMutation(req.params.projectId, req.user.orgId, async (project, session) => {
    confirmDeletion(req.body, project, project.name);
    requireValue(!(await Milestone.exists({
      projectId: project._id
    }).session(session || null)), 409, "This project still has milestones. Delete its empty milestones first. Milestones containing tasks or review history must be retained.");
    await Project.deleteOne({
      _id: project._id,
      orgId: req.user.orgId
    }, {
      session
    });
  });
  res.status(204).end();
}
