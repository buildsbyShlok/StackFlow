import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Search } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useWorkspace } from "@/context/workspace";
import { PageHeader, ErrorState, Modal } from "@/components/common";
import { Button } from "@/components/ui/button";
import { leaveWorkspace, removeMember, updateRole } from "@/services/workspace";
import { errorMessage } from "@/utils/api";
import { date, initials, roleLabels } from "@/lib/format";
import type { Member } from "@/types";
export default function Team() {
  const workspace = useWorkspace();
  const { user, accept } = useAuth();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const members = workspace.data.members.filter(
    (m) =>
      (!role || m.role === role) &&
      (m.name + " " + m.email).toLowerCase().includes(query.toLowerCase()),
  );
  async function changeMemberRole(id: string, next: string) {
    setBusy(true);
    setError("");
    try {
      await updateRole(id, next);
      await workspace.reload();
      workspace.notify(
        "Role updated. The member will see it after refreshing.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="BETTER, TOGETHER"
        title="Team"
        description="Clear ownership. Shared responsibility. People who move the work forward."
      />
      {user?.role === "admin" && workspace.data.org.inviteCode && (
        <div className="invite-strip">
          <div>
            <strong>Good work is a team effort.</strong>
            <p>
              Share this code to invite teammates. You can grant Tech Lead
              access after they join.
            </p>
          </div>
          <code>{workspace.data.org.inviteCode}</code>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  workspace.data.org.inviteCode!,
                );
                workspace.notify("Invite code copied.");
              } catch {
                workspace.notify("Copy the invite code shown here.");
              }
            }}
          >
            <Copy size={14} />
            Copy invite
          </Button>
        </div>
      )}
      <div className="list-toolbar">
        <span className="list-count">{members.length} members</span>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search team"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a teammate…"
          />
        </label>
        <select
          aria-label="Filter members by role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">All roles</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorState message={error} />}
      <div className="table-scroll">
        <table className="team-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Open tasks</th>
              <th>Verified</th>
              <th>Joined</th>
              {user?.role === "admin" && (
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member._id}
                className={
                  params.get("member") === member._id ? "highlight-row" : ""
                }
              >
                <td>
                  <div className="person">
                    <span className="avatar">{initials(member.name)}</span>
                    <div>
                      <strong>
                        {member.name}
                        {member._id === user?.id && <small> (you)</small>}
                      </strong>
                      <span>{member.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  {user?.role === "admin" && member.role !== "admin" ? (
                    <select
                      aria-label={"Role for " + member.name}
                      value={member.role}
                      disabled={busy}
                      onChange={(e) =>
                        void changeMemberRole(member._id, e.target.value)
                      }
                    >
                      <option value="teammate">Teammate</option>
                      <option value="techlead">Tech Lead</option>
                    </select>
                  ) : (
                    <span className="role-label">
                      {roleLabels[member.role]}
                    </span>
                  )}
                </td>
                <td className="mono">
                  {
                    workspace.data.tasks.filter(
                      (t) =>
                        t.assignedTo?._id === member._id &&
                        t.status !== "verified",
                    ).length
                  }
                </td>
                <td className="mono">
                  {
                    workspace.data.tasks.filter(
                      (t) =>
                        t.assignedTo?._id === member._id &&
                        t.status === "verified",
                    ).length
                  }
                </td>
                <td className="subtle nowrap">
                  {member.createdAt ? date(member.createdAt) : "—"}
                </td>
                {user?.role === "admin" && (
                  <td>
                    {member.role !== "admin" && (
                      <button
                        className="text-button danger-text"
                        onClick={() => {
                          setSelected(member);
                          setError("");
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!members.length && (
          <p className="empty-caption">No matching team members.</p>
        )}
      </div>
      <div className="team-permissions">
        <h3>Everyone has a part to play.</h3>
        <div>
          <p>
            <strong>Admin</strong>Sets up projects, manages members, and can
            review all work.
          </p>
          <p>
            <strong>Tech Lead</strong>Owns milestones, assigns tasks, and
            reviews their team's submissions.
          </p>
          <p>
            <strong>Teammate</strong>Delivers assigned tasks and responds to
            review feedback.
          </p>
        </div>
      </div>
      {user?.role !== "admin" && (
        <div className="leave-workspace">
          <div>
            <strong>Leave this workspace</strong>
            <p>
              You can leave once unfinished assignments and milestone ownership
              are reassigned.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setLeaving(true);
              setError("");
            }}
          >
            Leave workspace
          </Button>
        </div>
      )}
      {(selected || leaving) && (
        <Modal
          busy={busy}
          title={
            selected ? "Remove " + selected.name + "?" : "Leave this workspace?"
          }
          description="Workspace access will be removed. Unfinished tasks and milestone ownership must be reassigned first."
          onClose={() => {
            setSelected(null);
            setLeaving(false);
          }}
        >
          {error && <ErrorState message={error} />}
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setLeaving(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (selected) {
                    await removeMember(selected._id);
                    await workspace.reload();
                    setSelected(null);
                  } else {
                    accept(await leaveWorkspace());
                    setLeaving(false);
                  }
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "Updating…"
                : selected
                  ? "Remove member"
                  : "Leave workspace"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
