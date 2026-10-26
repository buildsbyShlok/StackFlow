import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { HttpError } from "../lib/errors.js";
export async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  let claims;
  try {
    claims = jwt.verify(token || "", process.env.ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in.");
  }
  const user = await User.findById(claims.id).select(
    "name email role orgId sessionVersion",
  );
  if (!user || (claims.version || 0) !== (user.sessionVersion || 0))
    throw new HttpError(401, "Please sign in again.");
  req.user = {
    id: String(user._id),
    name: user.name,
    role: user.role,
    orgId: user.orgId,
    email: user.email,
  };
  req.authVersion = user.sessionVersion || 0;
  next();
}
export function requireOrg(req, res, next) {
  if (!req.user.orgId)
    throw new HttpError(403, "Join a workspace to continue.");
  next();
}
