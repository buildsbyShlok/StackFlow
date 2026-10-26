import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import Milestone from "../models/Milestone.js";
import { requireValue, text } from "../lib/errors.js";
import { accessToken, publicUser } from "../lib/session.js";
import { workspace } from "../lib/workspace.js";
export async function joinOrganization(req, res) {
  const user = await User.findById(req.user.id);
  requireValue(
    !user.orgId,
    409,
    "Leave your current workspace before joining another.",
  );
  const org = await Organization.findOne({
    inviteCode: text(req.body.inviteCode, "Invite code", 100),
  });
  requireValue(org, 400, "Invalid invite code.");
  const result = await User.updateOne(
    { _id: user._id, orgId: null },
    { $set: { orgId: org._id, role: "teammate" } },
  );
  requireValue(
    result.modifiedCount,
    409,
    "Workspace membership changed. Refresh and try again.",
  );
  await Organization.updateOne(
    { _id: org._id },
    { $addToSet: { members: user._id } },
  );
  user.orgId = org._id;
  user.role = "teammate";
  res.json({ accessToken: accessToken(user), user: publicUser(user) });
}
export async function getOrg(req, res) {
  if (!req.user.orgId) return res.json({ org: null });
  const data = await workspace(req.user.orgId, req.user);
  res.json({ org: data.org });
}
async function checkAssignments(user) {
  const [tasks, milestones] = await Promise.all([
    Task.exists({
      orgId: user.orgId,
      assignedTo: user._id,
      status: { $ne: "verified" },
    }),
    Milestone.exists({ orgId: user.orgId, assignedTo: user._id }),
  ]);
  requireValue(
    !tasks && !milestones,
    409,
    "This member owns unfinished tasks or leads milestones. Reassign their work first.",
  );
}
export async function removeUser(req, res) {
  requireValue(
    typeof req.body.userId === "string" &&
      /^[a-f0-9]{24}$/i.test(req.body.userId),
    400,
    "Choose a valid member.",
  );
  const user = await User.findOne({
    _id: req.body.userId,
    orgId: req.user.orgId,
  });
  requireValue(user, 404, "Member not found.");
  requireValue(
    user.role !== "admin",
    403,
    "The workspace owner cannot be removed.",
  );
  await checkAssignments(user);
  await User.updateOne(
    { _id: user._id, orgId: req.user.orgId },
    {
      $set: { orgId: null },
      $unset: { refreshToken: 1 },
      $inc: { sessionVersion: 1 },
    },
  );
  await Organization.updateOne(
    { _id: req.user.orgId },
    { $pull: { members: user._id } },
  );
  res.json({ message: "Member removed." });
}
export async function leaveOrg(req, res) {
  const user = await User.findById(req.user.id);
  requireValue(
    user.role !== "admin",
    403,
    "The workspace owner must remain in the workspace.",
  );
  await checkAssignments(user);
  const orgId = user.orgId;
  user.orgId = null;
  await user.save();
  await Organization.updateOne(
    { _id: orgId },
    { $pull: { members: user._id } },
  );
  res.json({ accessToken: accessToken(user), user: publicUser(user) });
}
export async function changeRole(req, res) {
  requireValue(
    ["teammate", "techlead"].includes(req.body.role),
    400,
    "Choose Teammate or Tech Lead.",
  );
  const user = await User.findOne({
    _id: req.params.userId,
    orgId: req.user.orgId,
  });
  requireValue(user && user.role !== "admin", 404, "Member not found.");
  if (user.role !== req.body.role) {
    await checkAssignments(user);
    await User.updateOne(
      { _id: user._id, orgId: req.user.orgId, role: user.role },
      { $set: { role: req.body.role } },
    );
  }
  res.json({ message: "Role updated." });
}
