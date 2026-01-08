import express from "express";
import { getNotifications } from "../controllers/notificationController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
 import { getNotificationCount } from "../controllers/notificationController.js"
const router = express.Router();

router.get(
  "/",
  protect,
  authorize("admin", "receptionist"),
  getNotifications
);
router.get("/count", protect, getNotificationCount)
export default router;
