import express from "express";
import {
  createRoom,
  updateRoom,
  getRooms,
  updateRoomStatus,
  deleteRoom,
} from "../controllers/roomController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

import { adminOnly } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/", protect, adminOnly, createRoom);
router.put("/:id", protect, adminOnly, updateRoom);
router.delete("/:id", protect, adminOnly, deleteRoom);
// Receptionist route
router.patch("/status/:id", protect, updateRoomStatus);

// Everyone can view rooms
router.get("/", getRooms);

export default router;
