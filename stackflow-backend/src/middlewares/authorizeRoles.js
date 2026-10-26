import { HttpError } from "../lib/errors.js";
export const authorizeRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      throw new HttpError(403, "You do not have permission to do that.");
    next();
  };
