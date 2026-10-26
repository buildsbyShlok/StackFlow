import type { Status, Task, User, Milestone } from "@/types";
export const statusLabels: Record<Status, string> = {
  pending: "To do",
  in_progress: "In progress",
  completed: "In review",
  verified: "Verified",
  changes_requested: "Changes requested",
};
export const roleLabels = {
  admin: "Admin",
  techlead: "Tech Lead",
  teammate: "Teammate",
};
export const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "No deadline";
export const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
export const isOverdue = (task: Task) =>
  !!task.dueDate &&
  new Date(task.dueDate.slice(0, 10) + "T23:59:59") < new Date() &&
  !["completed", "verified"].includes(task.status);
export const canManage = (user: User, milestone: Milestone) =>
  user.role === "admin" ||
  (user.role === "techlead" && milestone.assignedTo?._id === user.id);
export const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
