import { Link, useParams } from "react-router-dom";
import { useWorkspace } from "@/context/workspace";
import TaskPanel from "./TaskPanel";
export default function TaskDetails() {
  const { taskId } = useParams();
  const workspace = useWorkspace();
  return (
    <>
      <Link to="/my-tasks" className="back-link">
        ← My tasks
      </Link>
      <div className="standalone-task">
        {taskId && <TaskPanel key={taskId} id={taskId} workspace={workspace} />}
      </div>
    </>
  );
}
