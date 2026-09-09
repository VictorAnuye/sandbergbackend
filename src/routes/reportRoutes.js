import express from "express";

import {
  generateReport,
  getReportReceptionists,
} from "../controllers/reportController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// =====================================
// RECEPTIONIST LIST FOR ADMIN REPORTS
// =====================================

router.get(
  "/receptionists",
  protect,
  authorize("admin"),
  getReportReceptionists
);

// =====================================
// GENERATE REPORT
// =====================================

router.get(
  "/",
  protect,
  authorize("admin", "receptionist"),
  generateReport
);

export default router;