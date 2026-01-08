import Booking from "../models/booking.js";
import Room from "../models/Rooms.js";
import Notification from "../models/notification.js";

export const createBooking = async (req, res) => {
  try {
    if (req.user.role !== "receptionist") {
      return res.status(403).json({ message: "Only receptionists can create bookings" });
    }

    const {
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,
      checkInDate,
      checkOutDate,
    } = req.body;

    if (!guestFullName || !guestPhone || !numberOfGuests || !checkInDate || !checkOutDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      return res.status(400).json({ message: "Invalid booking dates" });
    }

    console.log("Searching for available rooms...");
    console.log("Requested dates:", checkIn, "to", checkOut);

// Get all rooms
const rooms = await Room.find({});
console.log(`Found ${rooms.length} rooms in DB.`);

let selectedRoom = null;

for (const room of rooms) {
  console.log(`Checking room ${room.number} (${room._id}) for conflicts...`);

  // Check for overlapping bookings
  const conflict = await Booking.findOne({
    room: room._id,
    status: { $in: ["reserved", "checked-in"] },
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  });

  if (conflict) {
    console.log(
      `Conflict found with booking ${conflict._id}:`,
      `Status: ${conflict.status},`,
      `CheckIn: ${conflict.checkInDate},`,
      `CheckOut: ${conflict.checkOutDate}`
    );
  } else {
    console.log(`No conflict found. Selecting room ${room.number}.`);
    selectedRoom = room;
    break;
  }
}


    if (!selectedRoom) {
      console.log("No available rooms found for these dates.");
      return res.status(409).json({ message: "No available rooms for selected dates" });
    }

    const booking = await Booking.create({
      room: selectedRoom._id,
      roomNumber: selectedRoom.number,
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      handledBy: req.user._id,
      source: "reception",
      status: "reserved",
    });

    selectedRoom.status = "reserved";
    await selectedRoom.save();

    console.log(`Booking created successfully for room ${selectedRoom.number}`);

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: "Server error" });
  }
};


export const checkIn = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("room");

  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (booking.status !== "reserved") {
    return res.status(400).json({ message: "Booking not eligible for check-in" });
  }

  booking.status = "checked-in";
  await booking.save();

  booking.room.status = "occupied";
  await booking.room.save();

  res.json({ message: "Guest checked in", booking });
};

export const checkOut = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("room");

  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (booking.status !== "checked-in") {
    return res.status(400).json({ message: "Booking not eligible for check-out" });
  }

  booking.status = "checked-out";
  await booking.save();

  booking.room.status = "available";
  await booking.room.save();

  res.json({ message: "Guest checked out", booking });
};


export const getAllBookings = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }

  const bookings = await Booking.find()
    .populate("room", "roomNumber roomType")
    .populate("handledBy", "fullName email");

  res.json(bookings);
};

export const createOnlineBooking = async (req, res) => {
  try {
    const {
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,
      checkInDate,
      checkOutDate,
      selectedRoomId, // internal, not from user
    } = req.body;

    let roomNumber = null;

    // If frontend/system selected a room, get its roomNumber
    if (selectedRoomId) {
      const room = await Room.findById(selectedRoomId);
      if (!room) {
        return res.status(400).json({ error: "Selected room not found" });
      }
      roomNumber = room.roomNumber;
    }

    const booking = await Booking.create({
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,
      checkInDate,
      checkOutDate,
      source: "online",
      status: "pending",
      room: selectedRoomId || null,  // store room ObjectId if assigned
      roomNumber,                    // store human-readable roomNumber
    });

     await Notification.create({
      type: "ONLINE_BOOKING",
      booking: booking._id,
      message: `New online booking from ${booking.guestName}`,
    });

    res.status(201).json({
      message: "Booking request received. Awaiting confirmation.",
      booking,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


// Receptionist confirms a booking
export const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log("Booking ID received:", bookingId);

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Check if already confirmed
    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Booking is already confirmed or processed" });
    }
 
    let room;

    if (booking.room) {
      // Room already assigned in booking → use it
      room = await Room.findById(booking.room);
      if (!room) return res.status(404).json({ error: "Assigned room not found" });
    } else {
      // Auto-assign first available room if none assigned
      room = await Room.findOne({ status: "available" });
      if (!room) return res.status(400).json({ error: "No available rooms" });

      booking.room = room._id;
      booking.roomNumber = room.roomNumber;
    }

    // Prevent overlapping bookings for this room
    const overlapping = await Booking.findOne({
      room: room._id,
      status: { $in: ["reserved", "checked-in"] },
      $or: [
        {
          checkInDate: { $lt: booking.checkOutDate, $gte: booking.checkInDate },
        },
        {
          checkOutDate: { $gt: booking.checkInDate, $lte: booking.checkOutDate },
        },
        {
          checkInDate: { $lte: booking.checkInDate },
          checkOutDate: { $gte: booking.checkOutDate },
        },
      ],
    });

    if (overlapping) {
      return res
        .status(400)
        .json({ error: "Room is already booked for these dates" });
    }

    // Update booking
    booking.status = "reserved";
    booking.handledBy = req.user._id; // receptionist id
    await booking.save();

    // Update room status
    room.status = "reserved";
    room.lastUpdatedBy = req.user._id;
    await room.save();

     await Notification.findOneAndDelete({ booking: booking._id });

    res.json({ message: "Booking confirmed successfully", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getPendingBookings = async (req, res) => {
  if (req.user.role !== "receptionist") {
    return res.status(403).json({ message: "Receptionists only" });
  }

  const pendingBookings = await Booking.find({ status: "pending" })
    .sort({ createdAt: 1 }); // oldest first (FIFO)

  res.json({
    count: pendingBookings.length,
    bookings: pendingBookings,
  });
};

export const cancelBooking = async (req, res) => {
  if (req.user.role !== "receptionist") {
    return res.status(403).json({ message: "Receptionists only" });
  }

  const booking = await Booking.findById(req.params.id).populate("room");

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (booking.status === "checked-out") {
    return res.status(400).json({ message: "Cannot cancel completed booking" });
  }

  booking.status = "canceled";
  booking.handledBy = req.user._id;
  await booking.save();

  // Free room only if one was assigned
  if (booking.room) {
    booking.room.status = "available";
    await booking.room.save();
  }

  res.json({
    message: "Booking canceled successfully",
    booking,
  });
};

// Receptionist checks in a guest
export const checkInBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status !== "reserved") {
      return res.status(400).json({
        error: `Cannot check-in. Booking status is "${booking.status}"`,
      });
    }

    const room = await Room.findById(booking.room);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Update booking
    booking.status = "checked-in";
    await booking.save();

    // Update room
    room.status = "occupied";
    room.lastUpdatedBy = req.user._id;
    await room.save();

    res.json({ message: "Guest checked-in successfully", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Receptionist checks out a guest
export const checkOutBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status !== "checked-in") {
      return res.status(400).json({
        error: `Cannot check-out. Booking status is "${booking.status}"`,
      });
    }

    const room = await Room.findById(booking.room);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // Update booking
    booking.status = "checked-out";
    await booking.save();

    // Update room
    room.status = "available";
    room.lastUpdatedBy = req.user._id;
    await room.save();

    res.json({ message: "Guest checked-out successfully", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getAdminOverview = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can access this" });
    }

    const { type = "day", date = new Date().toISOString().split("T")[0] } = req.query;

    let start, end;

    const targetDate = new Date(date);

    switch (type) {
      case "day":
        start = new Date(targetDate.setHours(0, 0, 0, 0));
        end = new Date(targetDate.setHours(23, 59, 59, 999));
        break;
      case "month":
        start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "year":
        start = new Date(targetDate.getFullYear(), 0, 1);
        end = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        return res.status(400).json({ message: "Invalid type. Must be day, month, or year." });
    }

    // Fetch bookings in date range and populate room to get pricePerNight
    const bookings = await Booking.find({
      checkInDate: { $gte: start, $lte: end },
      status: { $ne: "canceled" },
    }).populate("room");

    let totalRevenue = 0;
    const bookingsByStatus = {};

    bookings.forEach((b) => {
      const nights =
        Math.ceil((new Date(b.checkOutDate) - new Date(b.checkInDate)) / (1000 * 60 * 60 * 24));
      const price = b.room ? b.room.pricePerNight : 0;
      totalRevenue += price * nights;

      bookingsByStatus[b.status] = (bookingsByStatus[b.status] || 0) + 1;
    });

    res.json({
      totalBookings: bookings.length,
      totalRevenue,
      bookingsByStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



