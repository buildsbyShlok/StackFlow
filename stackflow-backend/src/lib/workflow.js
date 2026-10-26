import { requireValue } from "./errors.js";
export const transitions = {
  start: {
    from: ["pending", "changes_requested"],
    to: "in_progress",
    owner: true,
  },
  complete: {
    from: ["pending", "in_progress", "changes_requested"],
    to: "completed",
    owner: true,
  },
  "undo-complete": { from: ["completed"], to: "in_progress", owner: true },
  verify: { from: ["completed"], to: "verified" },
  reject: { from: ["completed"], to: "changes_requested", reason: true },
  unverify: { from: ["verified"], to: "completed", reason: true },
};
export function canReview(user, milestone) {
  return (
    user.role === "admin" ||
    (user.role === "techlead" &&
      String(milestone.assignedTo?._id || milestone.assignedTo) ===
        String(user.id))
  );
}
export function validateTransition(action, task, milestone, user, reason) {
  const rule = transitions[action];
  requireValue(rule, 400, "Unknown task action.");
  requireValue(
    rule.owner
      ? user.role === "teammate" && String(task.assignedTo) === String(user.id)
      : canReview(user, milestone),
    403,
    "You do not have permission to update this task.",
  );
  requireValue(
    rule.from.includes(task.status),
    409,
    "This task changed or is not in the right state. Refresh and try again.",
  );
  requireValue(
    !rule.reason || (typeof reason === "string" && reason.trim().length > 0),
    400,
    "Explain why changes are needed.",
  );
  return rule;
}
export function progress(tasks) {
  const verifiedCount = tasks.filter((t) => t.status === "verified").length;
  return {
    taskCount: tasks.length,
    verifiedCount,
    progress: tasks.length
      ? Math.round((verifiedCount / tasks.length) * 100)
      : 0,
  };
}
