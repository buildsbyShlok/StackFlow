import bcrypt from "bcrypt";
import User from "../models/User.js";
import { text, requireValue } from "../lib/errors.js";
import { accessToken, publicUser, cookieOptions, sessionVersionFilter } from "../lib/session.js";
function allowedFields(body, fields) {
  requireValue(Object.keys(body).every(key => fields.includes(key)), 400, "Only the displayed personal fields can be changed. Email, role and workspace are read-only.");
}
export async function updateProfile(req, res) {
  allowedFields(req.body, ["name"]);
  const name = text(req.body.name, "Name", 80);
  const user = await User.findOneAndUpdate({
    _id: req.user.id,
    ...sessionVersionFilter(req.authVersion)
  }, {
    $set: {
      name
    }
  }, {
    new: true,
    runValidators: true
  });
  requireValue(user, 401, "Please sign in again.");
  res.json({
    accessToken: accessToken(user),
    user: publicUser(user)
  });
}
export async function changePassword(req, res) {
  allowedFields(req.body, ["currentPassword", "newPassword"]);
  const {
    currentPassword,
    newPassword
  } = req.body;
  requireValue(typeof currentPassword === "string" && Buffer.byteLength(currentPassword) <= 72, 400, "Enter your current password.");
  requireValue(typeof newPassword === "string" && newPassword.length >= 10 && Buffer.byteLength(newPassword) <= 72, 400, "Use a new password of at least 10 characters and at most 72 bytes.");
  requireValue(newPassword !== currentPassword, 400, "Choose a different password.");
  const user = await User.findById(req.user.id);
  requireValue(user && (await bcrypt.compare(currentPassword, user.password)), 400, "Your current password is incorrect.");
  const password = await bcrypt.hash(newPassword, 12);
  const result = await User.updateOne({
    _id: user._id,
    password: user.password,
    ...sessionVersionFilter(req.authVersion)
  }, {
    $set: {
      password
    },
    $unset: {
      refreshToken: 1
    },
    $inc: {
      sessionVersion: 1
    }
  });
  requireValue(result.modifiedCount, 409, "Your account changed. Sign in again before changing your password.");
  res.clearCookie("refreshToken", cookieOptions());
  res.clearCookie("refreshToken", {
    ...cookieOptions(),
    path: "/"
  });
  res.status(204).end();
}
