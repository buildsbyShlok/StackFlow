import jwt from "jsonwebtoken";
import { createHash, randomUUID } from "node:crypto";
import User from "../models/User.js";
import { requireValue } from "./errors.js";
export const sessionVersionFilter = (version = 0) => version ? {
  sessionVersion: version
} : {
  $or: [{
    sessionVersion: 0
  }, {
    sessionVersion: {
      $exists: false
    }
  }]
};
export const digest = value => createHash("sha256").update(value).digest("hex");
export const publicUser = user => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  orgId: user.orgId ? String(user.orgId) : null
});
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth"
});
export const accessToken = user => jwt.sign({
  id: String(user._id),
  role: user.role,
  orgId: user.orgId,
  version: user.sessionVersion || 0
}, process.env.ACCESS_SECRET, {
  expiresIn: "15m",
  algorithm: "HS256"
});
export async function startSession(user, res) {
  const refreshToken = jwt.sign({
    id: String(user._id),
    nonce: randomUUID()
  }, process.env.REFRESH_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256"
  });
  const current = await User.findOneAndUpdate({
    _id: user._id,
    password: user.password,
    ...sessionVersionFilter(user.sessionVersion)
  }, {
    $set: {
      refreshToken: digest(refreshToken),
      ...(user.isModified("orgId") ? {
        orgId: user.orgId || null
      } : {})
    },
    $inc: {
      sessionVersion: 1
    }
  }, {
    new: true
  });
  requireValue(current, 409, "Your account changed. Please sign in again.");
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions(),
    maxAge: 7 * 86400000
  });
  return {
    accessToken: accessToken(current),
    user: publicUser(current)
  };
}
