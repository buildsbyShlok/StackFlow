import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth";
import type { WorkspaceContext } from "@/context/workspace";
import type { Task } from "@/types";
import { actOnTask, deleteTask, getTask } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import { date, timestamp, statusLabels } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  StatusBadge,
} from "@/components/common";
import { TaskEditor } from "@/components/WorkForms";
import { Button } from "@/components/ui/button";

export default function TaskPanel({
  id,
  workspace,
}: {
  id: string;
  workspace: WorkspaceContext;
}) {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewAction, setReviewAction] = useState("");
  const [edit, setEdit] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = useCallback(async () => {
    try {
      setTask(await getTask(id));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    getTask(id)
      .then((t) => {
        if (active) setTask(t);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (deleted)
    return (
      <EmptyState
        title="Task deleted"
        description="The task was removed before work began."
      />
    );
  if (!task)
    return error ? (
      <ErrorState message={error} retry={() => void load()} />
    ) : (
      <Loading />
    );
  if (!user) return null;
  const owns = user.role === "teammate" && task.assignedTo?._id === user.id;
  const reviews =
    user.role === "admin" ||
    (user.role === "techlead" && task.milestone.assignedTo === user.id);
  const active = ["pending", "in_progress", "changes_requested"].includes(
    task.status,
  );
  const milestone = workspace.data.milestones.find(
    (m) => m._id === task.milestoneId,
  );
  async function transition(action: string) {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      await actOnTask(id, action, task.__v, reason);
      setReviewAction("");
      setReason("");
      await load();
      await workspace.reload();
      workspace.notify(
        action === "verify"
          ? "Work verified. Progress updated."
          : "Task updated.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="task-panel">
      <div className="task-context">
        <Link to={"/projects/" + task.project._id}>{task.project.name}</Link>
        <span>/</span>
        <Link to={"/tasks/" + task.milestoneId}>{task.milestone.title}</Link>
      </div>
      <h2>{task.title}</h2>
      <div className="task-meta">
        <StatusBadge status={task.status} />
        <span className={"priority priority-" + task.priority}>
          <i />
          {task.priority} priority
        </span>
      </div>
      <p className="task-description">
        {task.description || "No description provided."}
      </p>
      <dl className="task-properties">
        <div>
          <dt>Assigned to</dt>
          <dd>{task.assignedTo?.name || "Former member"}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{date(task.dueDate)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{date(task.createdAt)}</dd>
        </div>
        {task.completedAt && (
          <div>
            <dt>Submitted</dt>
            <dd>{timestamp(task.completedAt)}</dd>
          </div>
        )}
        {task.reviewedAt && (
          <div>
            <dt>Last reviewed</dt>
            <dd>{timestamp(task.reviewedAt)}</dd>
          </div>
        )}
      </dl>
      {task.status === "changes_requested" && task.reviewReason && (
        <div className="review-note">
          <strong>Changes requested</strong>
          <p>{task.reviewReason}</p>
        </div>
      )}
      {error && <ErrorState message={error} retry={() => void load()} />}
      <div className="task-actions">
        {owns && active && (
          <>
            {task.status !== "in_progress" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void transition("start")}
              >
                Start work
              </Button>
            )}
            <Button disabled={busy} onClick={() => void transition("complete")}>
              {busy ? "Updating…" : "Submit for review"}
            </Button>
          </>
        )}
        {owns && task.status === "completed" && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void transition("undo-complete")}
          >
            Withdraw submission
          </Button>
        )}
        {reviews && task.status === "completed" && (
          <>
            <Button disabled={busy} onClick={() => void transition("verify")}>
              Verify work
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => setReviewAction("reject")}
            >
              Request changes
            </Button>
          </>
        )}
        {reviews && task.status === "verified" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setReviewAction("unverify")}
          >
            Reopen review
          </Button>
        )}
        {reviews && active && milestone && (
          <Button variant="outline" onClick={() => setEdit(true)}>
            Edit task
          </Button>
        )}
        {reviews && task.status === "pending" && (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete task
          </Button>
        )}
      </div>
      {reviewAction && (
        <form
          className="review-form form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void transition(reviewAction);
          }}
        >
          <label>
            {reviewAction === "reject"
              ? "What needs to change?"
              : "Why reopen this review?"}
            <textarea
              autoFocus
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>
          <div className="actions">
            <Button disabled={busy || !reason.trim()} type="submit">
              {busy ? "Saving…" : "Save review"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReviewAction("")}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      <section className="task-history">
        <h3>History</h3>
        {task.history?.length ? (
          <ol>
            {[...task.history].reverse().map((event, index) => (
              <li key={index}>
                <i />
                <div>
                  <strong>{event.actorName}</strong>{" "}
                  <span>
                    {event.action === "created"
                      ? "created this task"
                      : event.action === "edited"
                        ? "updated this task"
                        : "moved work to " +
                          (event.to ? statusLabels[event.to] : event.action)}
                  </span>
                  {event.reason && <p>{event.reason}</p>}
                  <time dateTime={event.at}>{timestamp(event.at)}</time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="subtle">
            This task predates history tracking. New changes will appear here.
          </p>
        )}
      </section>
      {edit && milestone && (
        <TaskEditor
          task={task}
          milestone={milestone}
          workspace={workspace}
          onClose={() => {
            setEdit(false);
            void load();
          }}
        />
      )}
      {confirmDelete && (
        <Modal
          busy={busy}
          title="Delete this task?"
          description="Only unstarted tasks can be deleted. This cannot be undone."
          onClose={() => setConfirmDelete(false)}
        >
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteTask(id);
                  setDeleted(true);
                  setConfirmDelete(false);
                  await workspace.reload();
                } catch (e) {
                  setError(errorMessage(e));
                  setConfirmDelete(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete task
            </Button>
          </div>
        </Modal>
      )}
    </article>
  );
}
