import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/context/workspace";
import { useAuth } from "@/context/auth";
import { EmptyState, PageHeader, Progress } from "@/components/common";
import {
  MilestoneEditor,
  ProjectEditor,
  TaskEditor,
} from "@/components/WorkForms";
import TaskTable from "@/components/TaskTable";
import { Button } from "@/components/ui/button";
import { canManage, date, initials } from "@/lib/format";
import type { Milestone, Project } from "@/types";
import DeleteDialog from "@/components/DeleteDialog";
import { deleteProject, deleteMilestone } from "@/services/workspace";
export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { user } = useAuth();
  const project = workspace.data.projects.find((p) => p._id === projectId);
  const [tab, setTab] = useState("milestones");
  const [edit, setEdit] = useState(false);
  const [createMilestone, setCreateMilestone] = useState(false);
  const [editMilestone, setEditMilestone] = useState<Milestone | undefined>();
  const [taskMilestone, setTaskMilestone] = useState<Milestone | null>(null);
  const [deleting, setDeleting] = useState<"project" | Milestone | null>(null);
  const [projectDeletion, setProjectDeletion] = useState<Project | null>(null);
  if (!project || !user)
    return (
      <EmptyState
        title="Project not found"
        description="This project is unavailable or belongs to another workspace."
      >
        <Link to="/projects" className="text-button">
          Back to projects
        </Link>
      </EmptyState>
    );
  const tasks = project.milestones.flatMap((m) => m.tasks);
  const ids = new Set([
    ...tasks.map((t) => t.assignedTo?._id),
    ...project.milestones.map((m) => m.assignedTo?._id),
  ]);
  const members = workspace.data.members.filter((m) => ids.has(m._id));
  return (
    <>
      <Link to="/projects" className="back-link">
        ← All projects
      </Link>
      <PageHeader
        eyebrow="PROJECT"
        title={project.name}
        description={
          project.description ||
          "Add a description to give this project a clear purpose."
        }
      >
        {user.role === "admin" && (
          <Button variant="ghost" className="danger-text" onClick={() => { setProjectDeletion(project); setDeleting("project"); }}>Delete project</Button>
        )}
        {user.role === "admin" && (
          <Button variant="outline" onClick={() => setEdit(true)}>
            Edit project
          </Button>
        )}
        {user.role !== "teammate" && (
          <Button onClick={() => setCreateMilestone(true)}>
            <Plus size={15} />
            New milestone
          </Button>
        )}
      </PageHeader>
      <div className="project-overview">
        <div>
          <span className="eyebrow">VERIFIED PROGRESS</span>
          <Progress value={project.progress} />
          <p>
            {project.verifiedCount} of {project.taskCount} tasks accepted
          </p>
        </div>
        <div>
          <span className="eyebrow">MILESTONES</span>
          <strong>{project.milestones.length}</strong>
          <p>
            {
              project.milestones.filter(
                (m) => m.taskCount > 0 && m.progress === 100,
              ).length
            }{" "}
            complete
          </p>
        </div>
        <div>
          <span className="eyebrow">PROJECT TEAM</span>
          <div className="avatar-group">
            {members.slice(0, 5).map((m) => (
              <span key={m._id} className="avatar" title={m.name}>
                {initials(m.name)}
              </span>
            ))}
            {!members.length && (
              <span className="subtle">Not assigned yet</span>
            )}
          </div>
          <p>{members.length} contributors</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Project views">
        {["milestones", "tasks"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault(); const next = e.key === "Home" ? "milestones" : e.key === "End" ? "tasks" : t === "tasks" ? "milestones" : "tasks";
                setTab(next); (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next === "milestones" ? 0 : 1])?.focus();
              }
            }}
            key={t}
            onClick={() => setTab(t)}
          >
            {t === "milestones" ? "Milestones" : "All tasks"}
            <span>
              {t === "milestones" ? project.milestones.length : tasks.length}
            </span>
          </button>
        ))}
      </div>
      {tab === "tasks" ? (
        <TaskTable tasks={tasks} />
      ) : project.milestones.length ? (
        <div className="milestone-list">
          {project.milestones.map((milestone, index) => (
            <details key={milestone._id} className="milestone-section" open>
              <summary>
                <span className="milestone-number mono">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{milestone.title}</strong>
                  <p>
                    {milestone.assignedTo?.name || "Former lead"} <span>·</span>{" "}
                    Due {date(milestone.dueDate)}
                  </p>
                </div>
                <Progress value={milestone.progress} />
              </summary>
              <div className="milestone-body">
                <div className="milestone-toolbar">
                  <p>
                    {milestone.description ||
                      milestone.verifiedCount +
                      " of " +
                      milestone.taskCount +
                      " tasks verified"}
                  </p>
                  <div className="actions">
                    <Link className="text-button" to={"/tasks/" + milestone._id}>View all tasks</Link>
                    {user.role === "admin" && <button className="text-button danger-text" onClick={() => setDeleting(milestone)}>Delete milestone</button>}
                    {user.role === "admin" && (
                      <button
                        className="text-button"
                        onClick={() => setEditMilestone(milestone)}
                      >
                        Edit milestone
                      </button>
                    )}
                    {canManage(user, milestone) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTaskMilestone(milestone)}
                      >
                        <Plus size={14} />
                        Add task
                      </Button>
                    )}
                  </div>
                </div>
                <TaskTable
                  tasks={milestone.tasks}
                  compact
                  emptyTitle="Define the work."
                  emptyDescription="The assigned Tech Lead can add and assign tasks to this milestone."
                />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Break the outcome into milestones."
          description="Assign each milestone to a Tech Lead and give it a deadline."
        />
      )}
      {edit && (
        <ProjectEditor
          project={project}
          workspace={workspace}
          onClose={() => setEdit(false)}
        />
      )}
      {deleting && <DeleteDialog
        kind={deleting === "project" ? "project" : "milestone"}
        name={deleting === "project" ? (projectDeletion || project).name : deleting.title}
        description={deleting === "project" ? "This permanently deletes an empty project. Remove its empty milestones first. Projects with tasks or review history cannot be deleted." : "This permanently deletes an empty milestone. Delete unstarted tasks individually first. Started tasks and review history are protected."}
        remove={() => deleting === "project" ? deleteProject(project._id, (projectDeletion || project).__v || 0, (projectDeletion || project).name) : deleteMilestone(deleting._id, deleting.__v || 0, deleting.title)}
        onClose={() => setDeleting(null)}
        onDeleted={async () => { const isProject = deleting === "project"; setDeleting(null); if (isProject) navigate("/projects", { replace: true }); workspace.notify(isProject ? "Project deleted." : "Milestone deleted."); await workspace.reload().catch(() => { }); }}
      />}
      {(createMilestone || editMilestone) && (
        <MilestoneEditor
          projectId={project._id}
          milestone={editMilestone}
          workspace={workspace}
          onClose={() => {
            setCreateMilestone(false);
            setEditMilestone(undefined);
          }}
        />
      )}
      {taskMilestone && (
        <TaskEditor
          milestone={taskMilestone}
          workspace={workspace}
          onClose={() => setTaskMilestone(null)}
        />
      )}
    </>
  );
}
