import Room from "../models/Rooms.js";

// CREATE ROOM (ADMIN ONLY)
export const createRoom = async (req, res) => {
  try {
    const { roomNumber, roomType, pricePerNight, description } = req.body;

    if (!roomNumber || !pricePerNight) {
      return res.status(400).json({ message: "Room number and price required" });
    }

    const existingRoom = await Room.findOne({ roomNumber });
    if (existingRoom) {
      return res.status(400).json({ message: "Room number already exists" });
    }

    const room = await Room.create({
      roomNumber,
      roomType,
      pricePerNight,
      description,
    });

    res.status(201).json({ message: "Room created successfully", room });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};


// UPDATE ROOM (ADMIN ONLY - info updates)
export const updateRoom = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  // Only allow admin to change anything except status
  if (req.user.role === "receptionist" && updates.status) {
    return res
      .status(403)
      .json({ message: "Receptionist cannot update room info here" });
  }

  Object.assign(room, updates);
  await room.save();

  res.json({ message: "Room updated successfully", room });
};

// UPDATE ROOM STATUS (Receptionist ONLY)
export const updateRoomStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  if (!["available", "occupied", "reserved", "maintenance"].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  const room = await Room.findById(id);
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (req.user.role !== "receptionist") {
    return res
      .status(403)
      .json({ message: "Only receptionists can update room status" });
  }

  room.status = status;
  room.lastUpdatedBy = req.user._id;
  room.lastUpdatedAt = new Date();

  await room.save();

  res.json({ message: "Room status updated", room });
};

// GET ALL ROOMS (ADMIN + RECEPTIONIST)
export const getRooms = async (req, res) => {
  const rooms = await Room.find().populate(
    "lastUpdatedBy",
    "fullName email role" // only show these fields
  );

  // Optional: rename lastUpdatedBy to just the name for clarity
  const formattedRooms = rooms.map(room => ({
    _id: room._id,
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    pricePerNight: room.pricePerNight,
    status: room.status,
    description: room.description,
    lastUpdatedBy: room.lastUpdatedBy ? room.lastUpdatedBy.fullName : null,
    lastUpdatedAt: room.lastUpdatedAt,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    
  }));

  res.json(formattedRooms);
};



export const deleteRoom = async (req, res) => {
  try {
    console.log("🗑️ DELETE request received for room ID:", req.params.id)

    const room = await Room.findById(req.params.id)
    if (!room) {
      console.log("❌ Room not found")
      return res.status(404).json({ message: "Room not found" })
    }

    await room.remove()
    console.log("✅ Room deleted successfully:", room)
    return res.status(200).json({ message: "Room deleted successfully" })
  } catch (err) {
    console.error("❌ Error deleting room:", err)
    return res.status(500).json({ message: "Server error" })
  }
}

