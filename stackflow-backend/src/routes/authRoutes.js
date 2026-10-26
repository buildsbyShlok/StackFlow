import express from "express";
import {
  register,
  loginUser,
  logoutUser,
  refreshAccessToken,
} from "../controllers/authController.js";
import { authenticateToken } from "../middlewares/authenticateToken.js";
import { updateProfile, changePassword } from "../controllers/profileController.js";
const router = express.Router();
router.post("/register", register);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/refresh", refreshAccessToken);
router.patch("/profile", authenticateToken, updateProfile);
router.post("/password", authenticateToken, changePassword);
router.get("/profile", authenticateToken, (req, res) =>
  res.json({ user: req.user }),
);
export default router;
