import User from "../models/User.js";
import Organization from "../models/Organization.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { requireValue, text } from "../lib/errors.js";
import {
  accessToken,
  cookieOptions,
  digest,
  publicUser,
  startSession,
} from "../lib/session.js";

const emailValue = (value) => {
  const email = text(value, "Email", 254).toLowerCase();
  requireValue(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    400,
    "Enter a valid email address.",
  );
  return email;
};
export async function register(req, res) {
  const name = text(req.body.name, "Name", 80);
  const email = emailValue(req.body.email);
  const password = req.body.password;
  requireValue(
    typeof password === "string" &&
      password.length >= 10 &&
      Buffer.byteLength(password) <= 72,
    400,
    "Use a password of at least 10 characters and at most 72 bytes.",
  );
  const role = req.body.role || "teammate";
  requireValue(
    ["admin", "teammate"].includes(role),
    400,
    "Join as a teammate. Your workspace admin can grant Tech Lead access.",
  );
  requireValue(
    !(await User.exists({ email }).collation({ locale: "en", strength: 2 })),
    409,
    "An account with that email already exists.",
  );
  let org;
  let orgName;
  if (role === "admin")
    orgName = text(
      req.body.orgName || name + "'s Workspace",
      "Workspace name",
      100,
    );
  else {
    const inviteCode = text(req.body.inviteCode, "Invite code", 100);
    org = await Organization.findOne({ inviteCode });
    requireValue(org, 400, "That invite code is invalid.");
  }
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role,
    orgId: org?._id,
  });
  try {
    if (role === "admin") {
      org = await Organization.create({
        name: orgName,
        createdBy: user._id,
        members: [user._id],
        inviteCode: randomBytes(16).toString("hex"),
      });
      user.orgId = org._id;
    } else
      await Organization.updateOne(
        { _id: org._id },
        { $addToSet: { members: user._id } },
      );
    const session = await startSession(user, res);
    res.status(201).json({ message: "Account created.", ...session });
  } catch (error) {
    // Compensate setup failures on standalone MongoDB, where transactions are unavailable.
    await User.deleteOne({ _id: user._id });
    if (role === "admin" && org)
      await Organization.deleteOne({ _id: org._id, createdBy: user._id });
    else if (org)
      await Organization.updateOne(
        { _id: org._id },
        { $pull: { members: user._id } },
      );
    throw error;
  }
}
export async function loginUser(req, res) {
  const email = emailValue(req.body.email);
  requireValue(
    typeof req.body.password === "string" &&
      Buffer.byteLength(req.body.password) <= 72,
    400,
    "Enter a valid password.",
  );
  const user = await User.findOne({ email }).collation({
    locale: "en",
    strength: 2,
  });
  requireValue(
    user && (await bcrypt.compare(req.body.password, user.password)),
    401,
    "Email or password is incorrect.",
  );
  res.json(await startSession(user, res));
}
export async function logoutUser(req, res) {
  const token = req.cookies.refreshToken;
  if (token)
    await User.updateOne(
      { refreshToken: { $in: [digest(token), token] } },
      { $unset: { refreshToken: 1 }, $inc: { sessionVersion: 1 } },
    );
  res.clearCookie("refreshToken", cookieOptions());
  // Also clear the previous version's root-path cookie.
  res.clearCookie("refreshToken", { ...cookieOptions(), path: "/" });
  res.status(204).end();
}
export async function refreshAccessToken(req, res) {
  const token = req.cookies.refreshToken;
  let claims;
  try {
    claims = jwt.verify(token || "", process.env.REFRESH_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }
  const user = await User.findOne({
    _id: claims.id,
    refreshToken: { $in: [digest(token), token] },
  });
  requireValue(user, 401, "Please sign in again.");
  res.json({ accessToken: accessToken(user), user: publicUser(user) });
}
