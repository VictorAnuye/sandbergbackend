import express from "express";
import {
  createBooking,
  checkIn,
  checkOut,
  cancelBooking,
  confirmBooking,
  getAllBookings,
  createOnlineBooking,
  getPendingBookings,
  checkInBooking,
  checkOutBooking,
  getAdminOverview,
} from "../controllers/bookingController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createBooking);
router.patch("/:bookingId/check-in", protect, checkIn);
router.patch("/:bookingId/check-out", protect, checkOut);
router.patch("/:bookingId/cancel", protect, cancelBooking);
router.get("/", protect, getAllBookings);
router.get("/pending", protect, getPendingBookings); 
router.patch("/:bookingId/confirm", protect, confirmBooking);
router.post("/online", createOnlineBooking);
router.post("/:bookingId/check-in", protect, authorize("receptionist"), checkInBooking);
router.post("/:bookingId/check-out", protect, authorize("receptionist"), checkOutBooking);
router.get("/overview", protect, getAdminOverview);
export default router;
