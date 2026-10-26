import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { useAuth } from "@/context/auth";
import { EmptyState, PageHeader, ProjectList } from "@/components/common";
import TaskTable from "@/components/TaskTable";
import { isOverdue, timestamp } from "@/lib/format";
export default function Dashboard() {
  const { data } = useWorkspace();
  const { user } = useAuth();
  const mine = data.tasks.filter(
    (t) => t.assignedTo?._id === user?.id && t.status !== "verified",
  );
  const pending = data.tasks.filter((t) => t.status === "completed");
  const overdue = data.tasks.filter(isOverdue);
  const verified = data.tasks.filter((t) => t.status === "verified");
  const activity = data.tasks
    .filter((t) => t.reviewedAt)
    .sort((a, b) => (b.reviewedAt || "").localeCompare(a.reviewedAt || ""))
    .slice(0, 4);
  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date())}
        title={"A clear view of what’s next."}
        description={
          data.org.name + " · Bring your work across the finish line."
        }
      />
      <section className="summary-strip" aria-label="Workspace summary">
        <Link to="/projects">
          <span>Projects</span>
          <strong>{data.projects.length}</strong>
          <small>Across the workspace</small>
        </Link>
        <Link to="/my-tasks">
          <span>My open tasks</span>
          <strong>{mine.length}</strong>
          <small>Assigned to you</small>
        </Link>
        <Link to={user?.role === "teammate" ? "/my-tasks" : "/verification"}>
          <span>Awaiting review</span>
          <strong>{pending.length}</strong>
          <small>Workspace submissions</small>
        </Link>
        <div>
          <span>Work verified</span>
          <strong>
            {verified.length}
            <em> / {data.tasks.length}</em>
          </strong>
          <small>
            {overdue.length
              ? overdue.length + " tasks overdue"
              : "No overdue tasks"}
          </small>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="section-number">01</span>
          <h2>Projects in motion</h2>
        </div>
        <Link to="/projects">
          View all projects <ArrowRight size={14} />
        </Link>
      </div>
      {data.projects.length ? (
        <ProjectList projects={data.projects.slice(0, 4)} />
      ) : (
        <EmptyState
          title="Every outcome starts with a project."
          description={
            user?.role === "admin"
              ? "Create your first project, then break it into milestones."
              : "Your Admin can create your team's first project."
          }
        >
          <Link className="text-button" to="/projects">
            Open projects <ArrowRight size={14} />
          </Link>
        </EmptyState>
      )}
      <div className="overview-bottom">
        <section>
          <div className="section-heading">
            <div>
              <span className="section-number">02</span>
              <h2>Your next moves</h2>
            </div>
            <Link to="/my-tasks">
              My tasks <ArrowRight size={14} />
            </Link>
          </div>
          <TaskTable
            tasks={mine}
            compact
            emptyTitle="Your slate is clear."
            emptyDescription={
              user?.role === "teammate"
                ? "When your Tech Lead assigns work, you’ll find it here."
                : "You manage delivery. Your teammates’ assignments appear inside each project."
            }
          />
        </section>
        <aside className="review-digest">
          <div className="section-heading">
            <div>
              <h2>Recent reviews</h2>
            </div>
          </div>
          {activity.length ? (
            activity.map((t) => (
              <Link key={t._id} to={"?task=" + t._id} className="digest-item">
                <span
                  className={
                    "digest-dot " +
                    (t.status === "verified" ? "is-verified" : "")
                  }
                />
                <div>
                  <strong>{t.title}</strong>
                  <p>
                    {t.status === "verified" ? "Verified" : "Review updated"} ·{" "}
                    {data.members.find((m) => m._id === t.reviewedBy)?.name ||
                      "Former member"}
                  </p>
                  <small>{timestamp(t.reviewedAt!)}</small>
                </div>
              </Link>
            ))
          ) : (
            <p className="subtle digest-empty">
              As work is reviewed, the latest decisions will appear here.
            </p>
          )}
          <div className="digest-note">
            <strong>Done means verified.</strong>
            <p>
              Progress moves when a Tech Lead accepts the work. Every finish has
              a second pair of eyes.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
