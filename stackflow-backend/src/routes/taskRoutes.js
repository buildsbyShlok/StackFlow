import express from "express";
import {
  authenticateToken,
  requireOrg,
} from "../middlewares/authenticateToken.js";
import {
  createTask,
  getTasksForMilestone,
  getTaskById,
  transitionTask,
  updateTask,
  deleteTask,
} from "../controllers/taskController.js";
const router = express.Router();
router.use(authenticateToken, requireOrg);
router.post("/create/:milestoneId", createTask);
router.get("/details/:taskId", getTaskById);
for (const action of [
  "start",
  "complete",
  "undo-complete",
  "verify",
  "reject",
  "unverify",
])
  router.post("/" + action + "/:taskId", transitionTask(action));
router.patch("/:taskId", updateTask);
router.delete("/:taskId", deleteTask);
// Preserve the original accidentally doubled delete URL.
router.delete("/tasks/:taskId", deleteTask);
router.get("/:milestoneId", getTasksForMilestone);
export default router;
