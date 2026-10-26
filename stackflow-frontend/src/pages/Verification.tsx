import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { useWorkspace } from "@/context/workspace";
import { EmptyState, PageHeader } from "@/components/common";
import TaskTable from "@/components/TaskTable";
export default function Verification() {
  const { data } = useWorkspace();
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (user?.role === "teammate")
    return (
      <EmptyState
        title="Reviews belong to your Tech Lead."
        description="Open My tasks to see feedback and submit your work."
      />
    );
  const scope = data.tasks.filter(
    (t) => user?.role === "admin" || t.milestone.assignedTo === user?.id,
  );
  const pending = scope.filter((t) => t.status === "completed");
  const oldest = pending.length
    ? Math.max(
        0,
        ...pending.map(
          (t) => now - new Date(t.completedAt || t.updatedAt).getTime(),
        ),
      )
    : 0;
  const verifiedToday = scope.filter(
    (t) =>
      t.verifiedAt &&
      t.status === "verified" &&
      new Date(t.verifiedAt).toDateString() === new Date().toDateString(),
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="THE FINAL MILE"
        title="Verification"
        description="Good work gets a second pair of eyes. Review, accept, or give clear feedback."
      />
      <div className="review-summary">
        <div>
          <strong>{pending.length}</strong>
          <span>waiting for your review</span>
        </div>
        <div>
          <strong>
            {pending.length
              ? oldest < 3600000
                ? "<1h"
                : Math.floor(oldest / 3600000) + "h"
              : "—"}
          </strong>
          <span>oldest submission</span>
        </div>
        <div>
          <strong>{verifiedToday}</strong>
          <span>verified today in your scope</span>
        </div>
      </div>
      <div className="review-explainer">
        <span className="review-step">
          01 <strong>Open the task</strong>
        </span>
        <span className="review-step">
          02 <strong>Check the outcome</strong>
        </span>
        <span className="review-step">
          03 <strong>Verify or request changes</strong>
        </span>
      </div>
      <TaskTable
        review
        tasks={pending}
        emptyTitle="Nothing waiting on you."
        emptyDescription="Submitted tasks will appear here. Only your assigned milestones are shown unless you’re an Admin."
      />
    </>
  );
}
