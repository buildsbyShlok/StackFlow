import express from "express";
import {
  authenticateToken,
  requireOrg,
} from "../middlewares/authenticateToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  joinOrganization,
  getOrg,
  leaveOrg,
  removeUser,
  changeRole,
} from "../controllers/orgController.js";
import Organization from "../models/Organization.js";
const router = express.Router();
router.use(authenticateToken);
router.get("/me", getOrg);
router.post("/join", joinOrganization);
router.use(requireOrg);
router.post("/leave", leaveOrg);
router.post("/remove-user", authorizeRoles("admin"), removeUser);
router.patch("/members/:userId", authorizeRoles("admin"), changeRole);
router.get("/invite", authorizeRoles("admin"), async (req, res) => {
  const org = await Organization.findById(req.user.orgId).select("inviteCode");
  res.json({ inviteCode: org?.inviteCode });
});
export default router;
