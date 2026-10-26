import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { useAuth } from "@/context/auth";
import { PageHeader, EmptyState, Progress } from "@/components/common";
import TaskTable from "@/components/TaskTable";
import { TaskEditor } from "@/components/WorkForms";
import { Button } from "@/components/ui/button";
import { canManage, date } from "@/lib/format";
export default function Tasks() {
  const { milestoneId } = useParams();
  const workspace = useWorkspace();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const milestone = workspace.data.milestones.find(
    (m) => m._id === milestoneId,
  );
  if (milestoneId && !milestone)
    return (
      <EmptyState
        title="Milestone not found"
        description="Check the link or return to Projects."
      />
    );
  const tasks = milestone
    ? milestone.tasks
    : workspace.data.tasks.filter((t) => t.assignedTo?._id === user?.id);
  return (
    <>
      {milestone && (
        <Link className="back-link" to={"/projects/" + milestone.projectId}>
          ← Back to project
        </Link>
      )}
      <PageHeader
        eyebrow={milestone ? "MILESTONE" : "PERSONAL WORKSPACE"}
        title={milestone?.title || "My tasks"}
        description={
          milestone
            ? "Led by " +
              (milestone.assignedTo?.name || "a former member") +
              " · Due " +
              date(milestone.dueDate)
            : "Your commitments, from the first move to the final review."
        }
      >
        {milestone && user && canManage(user, milestone) && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            Add task
          </Button>
        )}
      </PageHeader>
      {milestone && (
        <div className="milestone-progress">
          <Progress value={milestone.progress} />
          <span>
            {milestone.verifiedCount} of {milestone.taskCount} verified
          </span>
        </div>
      )}
      <TaskTable tasks={tasks} />
      {open && milestone && (
        <TaskEditor
          milestone={milestone}
          workspace={workspace}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
