import express from "express";
import {
  authenticateToken,
  requireOrg,
} from "../middlewares/authenticateToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";
const router = express.Router();
router.use(authenticateToken, requireOrg);
router.get("/", getAllProjects);
router.post("/create", authorizeRoles("admin"), createProject);
router.get("/details/:projectId", getProjectById);
router.patch("/:projectId", authorizeRoles("admin"), updateProject);
router.delete("/:projectId", authorizeRoles("admin"), deleteProject);
export default router;
