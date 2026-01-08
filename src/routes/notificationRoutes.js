import express from "express";
import { getNotifications } from "../controllers/notificationController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
 
const router = express.Router();

router.get(
  "/",
  protect,
  authorize("admin", "receptionist"),
  getNotifications
);
 
export default router;
