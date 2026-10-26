import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import type { Task } from "@/types";
import { date, isOverdue, statusLabels, timestamp } from "@/lib/format";
import { EmptyState, StatusBadge } from "./common";
export default function TaskTable({
  tasks,
  compact = false,
  review = false,
  emptyTitle = "No tasks here yet",
  emptyDescription = "Tasks will appear here when work is assigned.",
}: {
  tasks: Task[];
  compact?: boolean;
  review?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState(
    review ? "submitted" : compact ? "due" : "updated",
  );
  const [page, setPage] = useState(0);
  const [params, setParams] = useSearchParams();
  const filtered = tasks.filter(
    (t) =>
      (!status || t.status === status) &&
      (!priority || t.priority === priority) &&
      (t.title + " " + t.project.name + " " + (t.assignedTo?.name || ""))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const priorities = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) =>
    sort === "priority"
      ? priorities[a.priority] - priorities[b.priority]
      : sort === "due"
        ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
        : sort === "submitted"
          ? (a.completedAt || a.updatedAt).localeCompare(
              b.completedAt || b.updatedAt,
            )
          : b.updatedAt.localeCompare(a.updatedAt),
  );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(sorted.length / 15) - 1),
  );
  const shown = compact
    ? sorted.slice(0, 6)
    : sorted.slice(safePage * 15, safePage * 15 + 15);
  if (!tasks.length)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div>
      {!compact && (
        <div className="list-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              aria-label="Filter tasks"
              placeholder="Find a task…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All priorities</option>
            {["urgent", "high", "medium", "low"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort tasks"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated">Recently updated</option>
            {review && <option value="submitted">Oldest submission</option>}
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      )}
      {shown.length ? (
        <div className="table-scroll">
          <table className="task-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                {!compact && <th>Assignee</th>}
                <th>Priority</th>
                <th>Due</th>
                {review && <th>Submitted</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((task) => (
                <tr key={task._id}>
                  <td>
                    <button
                      className="task-title"
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set("task", task._id);
                        setParams(next);
                      }}
                    >
                      {task.title}
                    </button>
                    <div className="table-secondary">
                      {task.project.name} <span> / </span>
                      {task.milestone.title}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={task.status} />
                  </td>
                  {!compact && (
                    <td className="assignee-cell">
                      {task.assignedTo?.name || "Former member"}
                    </td>
                  )}
                  <td>
                    <span className={"priority priority-" + task.priority}>
                      <i />
                      {task.priority}
                    </span>
                  </td>
                  <td
                    className={
                      isOverdue(task) ? "overdue nowrap" : "subtle nowrap"
                    }
                  >
                    {task.dueDate ? date(task.dueDate) : "—"}
                    {isOverdue(task) && <small>Overdue</small>}
                  </td>
                  {review && (
                    <td className="subtle nowrap">
                      {timestamp(task.completedAt || task.updatedAt)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No matches"
          description="Try another search or remove a filter."
        />
      )}
      {!compact && sorted.length > 15 && (
        <div className="pagination">
          <span>
            {safePage * 15 + 1}–{Math.min(sorted.length, safePage * 15 + 15)} of{" "}
            {sorted.length}
          </span>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </button>
          <button
            disabled={(safePage + 1) * 15 >= sorted.length}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
