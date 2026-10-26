import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, Modal } from "./common";
import { saveProject, saveMilestone, saveTask } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import type { Milestone, Project, Task } from "@/types";
import type { WorkspaceContext } from "@/context/workspace";
import { useAuth } from "@/context/auth";

function useSubmit(
  save: (body: Record<string, unknown>) => Promise<unknown>,
  workspace: WorkspaceContext,
  close: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await save(Object.fromEntries(new FormData(e.currentTarget)));
      close();
      workspace.notify("Saved successfully.");
      await workspace.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return { submit, busy, error };
}
function FormFooter({ busy, unavailable = false, onClose }: { busy: boolean; unavailable?: boolean; onClose: () => void }) {
  return (
    <div className="form-footer">
      <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy || unavailable}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
export function ProjectEditor({
  project,
  workspace,
  onClose,
}: {
  project?: Project;
  workspace: WorkspaceContext;
  onClose: () => void;
}) {
  const { submit, busy, error } = useSubmit(
    (body) => saveProject(body, project?._id),
    workspace,
    onClose,
  );
  return (
    <Modal
      title={project ? "Edit project" : "Create a project"}
      description="Give your team a clear outcome to work toward."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Project name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={project?.name}
            placeholder="e.g. Customer portal"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={5000}
            rows={3}
            defaultValue={project?.description}
            placeholder="What are we working toward?"
          />
        </label>
        {error && <ErrorState message={error} />}
        <FormFooter busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function MilestoneEditor({
  projectId,
  milestone,
  workspace,
  onClose,
}: {
  projectId: string;
  milestone?: Milestone;
  workspace: WorkspaceContext;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const leads = workspace.data.members.filter(
    (m) =>
      m.role === "techlead" && (user?.role === "admin" || m._id === user?.id),
  );
  const { submit, busy, error } = useSubmit(
    (body) => saveMilestone(projectId, body, milestone?._id),
    workspace,
    onClose,
  );
  return (
    <Modal
      title={milestone ? "Edit milestone" : "Create a milestone"}
      description="Set an outcome, a responsible Tech Lead, and a deadline."
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Milestone name
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={milestone?.title}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={2}
            maxLength={5000}
            defaultValue={milestone?.description}
          />
        </label>
        <div className="form-grid">
          <label>
            Tech Lead
            <select
              aria-label="Tech Lead"
              name="assignedToEmail"
              required
              defaultValue={milestone?.assignedTo?.email || ""}
            >
              <option value="" disabled>
                Choose a lead
              </option>
              {leads.map((m) => (
                <option key={m._id} value={m.email}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline
            <input
              type="date"
              name="dueDate"
              required
              defaultValue={milestone?.dueDate?.slice(0, 10)}
            />
          </label>
        </div>
        {!leads.length && (
          <p className="form-hint">
            An Admin needs to assign a Tech Lead role on the Team page first.
          </p>
        )}
        {error && <ErrorState message={error} />}
        <FormFooter busy={busy} unavailable={!leads.length} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function TaskEditor({
  milestone,
  task,
  workspace,
  onClose,
}: {
  milestone: Milestone;
  task?: Task;
  workspace: WorkspaceContext;
  onClose: () => void;
}) {
  const teammates = workspace.data.members.filter((m) => m.role === "teammate");
  const { submit, busy, error } = useSubmit(
    (body) =>
      saveTask(milestone._id, { ...body, version: task?.__v }, task?._id),
    workspace,
    onClose,
  );
  return (
    <Modal
      title={task ? "Edit task" : "Create a task"}
      busy={busy}
      description={
        milestone.title + " · Define the work and who will deliver it."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Task title
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title}
            placeholder="A specific, actionable piece of work"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={10000}
            rows={4}
            defaultValue={task?.description}
            placeholder="Context and acceptance criteria"
          />
        </label>
        <label>
          Assigned teammate
          <select
            aria-label="Assigned teammate"
            name="assignedToEmail"
            required
            defaultValue={task?.assignedTo?.email || ""}
          >
            <option value="" disabled>
              Choose a teammate
            </option>
            {teammates.map((m) => (
              <option key={m._id} value={m.email}>
                {m.name} — {m.email}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Priority
            <select
              aria-label="Priority"
              name="priority"
              defaultValue={task?.priority || "medium"}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Due date <span className="optional">optional</span>
            <input
              type="date"
              name="dueDate"
              defaultValue={task?.dueDate?.slice(0, 10)}
            />
          </label>
        </div>
        {!teammates.length && (
          <p className="form-hint">
            Invite a teammate from the Team page before creating tasks.
          </p>
        )}
        {error && <ErrorState message={error} />}
        <FormFooter busy={busy} unavailable={!teammates.length} onClose={onClose} />
      </form>
    </Modal>
  );
}
