export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireValue(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}
export function text(value, label, max = 200, optional = false) {
  requireValue(
    typeof value === "string" || (optional && value == null),
    400,
    label + " must be text.",
  );
  const result = (value ?? "").trim();
  requireValue(
    (optional || result.length > 0) && result.length <= max,
    400,
    label + " is required and must be at most " + max + " characters.",
  );
  return result;
}
export function dueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  requireValue(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value),
    400,
    "Enter a valid due date.",
  );
  const date = new Date(value.length === 10 ? value + "T23:59:59.999Z" : value);
  requireValue(Number.isFinite(date.getTime()), 400, "Enter a valid due date.");
  requireValue(
    date.toISOString().slice(0, 10) === value.slice(0, 10),
    400,
    "Enter a valid due date.",
  );
  return date;
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error.name === "CastError" || error.name === "ValidationError") {
    status = 400;
    message = "Some fields are invalid. Check your input.";
  }
  if (error.code === 11000) {
    status = 409;
    message = "That record already exists.";
  }
  if (status >= 500) {
    message = "Something went wrong. Please try again.";
    console.error("Request failed:", error.name, req.method, req.path);
  }
  res.status(status).json({ message });
}
