import Booking from "../models/booking.js";
import Room from "../models/Rooms.js";
import Notification from "../models/notification.js";
import BookingTransaction from "../models/bookingTransaction.js";

import {
  getRateTypeForDate,
  calculateBookingTotal,
  calculateOnlineBookingPrice,
} from "../utils/pricing.js";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================================
// PRICING HELPERS
// ============================================================

const VALID_RATE_TYPES = ["WEEKDAY", "WEEKEND"];


/**
 * Create/update the pricing snapshot on a booking.
 *
 * This is intentionally stored on Booking so that future
 * changes to Room pricing do not alter an existing booking.
 */
const applyBookingPricing = async ({
  booking,
  room,
}) => {
  if (!room) {
    throw new Error(
      "A room is required to calculate booking pricing."
    );
  }

  const pricing = calculateBookingTotal({
    room,
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
  });

  booking.rate_type =
    pricing.rateType;

  booking.applied_rate =
    pricing.rate;

  booking.total_charge =
    pricing.total;

  booking.pricingBreakdown =
    pricing.breakdown.map((item) => ({
      date: item.date,
      rate_type: item.rateType,
      applied_rate: item.rate,
    }));

  return pricing;
};


/**
 * Create the financial transaction when a guest checks in.
 *
 * This function is deliberately idempotent:
 * checking the same booking in twice will NOT create
 * duplicate financial records.
 */
const createCheckInTransaction = async ({
  booking,
  room,
  staffId,
}) => {
  const existingTransaction = await BookingTransaction.findOne({
    booking: booking._id,
  });

  if (existingTransaction) {
    // If the transaction already exists, don't create another one.
    // This protects revenue from accidental duplicate check-in calls.
    return existingTransaction;
  }

  const transaction = await BookingTransaction.create({
    booking: booking._id,

    guestFullName: booking.guestFullName,

    room: room?._id || booking.room || null,

    roomNumber:
      booking.roomNumber ||
      room?.roomNumber ||
      null,

    roomType: room?.roomType || null,

    rate_type: booking.rate_type,

    total_charge: Number(booking.total_charge || 0),

    pricingBreakdown:
  booking.pricingBreakdown || [],

    source: booking.source,

    staff:
      booking.source === "online"
        ? null
        : staffId || booking.handledBy || null,

    status: "CHECKED_IN",

    checkInAt: new Date(),
  });

  return transaction;
};


export const createBooking = async (req, res) => {
  try {
    // 1️⃣ Authorization
    if (req.user.role !== "receptionist") {
      return res
        .status(403)
        .json({ message: "Only receptionists can create bookings" });
    }

    // 2️⃣ Extract body
    const {
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,
      checkInDate,
      checkOutDate,
      roomNumber,
      rate_type,
    } = req.body;

    // 3️⃣ Validate required fields
    if (
      !guestFullName ||
      !guestPhone ||
      !numberOfGuests ||
      !checkInDate ||
      !checkOutDate ||
      !roomNumber
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // 4️⃣ Validate rate type
    // 4️⃣ Validate rate type
if (!["WEEKDAY", "WEEKEND"].includes(rate_type)) {
  return res.status(400).json({
    message: "Invalid rate_type. Expected WEEKDAY or WEEKEND",
  });
}

// 5️⃣ Validate dates
const checkIn = new Date(checkInDate);
const checkOut = new Date(checkOutDate);

if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
  return res.status(400).json({
    message: "Invalid booking dates",
  });
}

if (checkOut <= checkIn) {
  return res.status(400).json({
    message: "Invalid booking dates",
  });
}

// 6️⃣ Validate rate type against actual check-in date
const expectedRateType = getRateTypeForDate(checkIn);

if (rate_type !== expectedRateType) {
  return res.status(400).json({
    message: `Invalid rate_type for check-in date. Expected ${expectedRateType}.`,
  });
}

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({
        message: "Invalid booking dates",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        message: "Invalid booking dates",
      });
    }

    console.log("🔍 Walk-in booking request");
    console.log("Requested room:", roomNumber);
    console.log("Requested dates:", checkIn, "→", checkOut);
    console.log("Requested rate type:", rate_type);

    // 6️⃣ Find EXACTLY the selected room
    const selectedRoom = await Room.findOne({
      roomNumber,
    });

    if (!selectedRoom) {
      console.log(`❌ Room ${roomNumber} not found`);

      return res.status(404).json({
        message: `Room ${roomNumber} not found`,
      });
    }

    console.log(
      `🏨 Selected room found: ${selectedRoom.roomNumber} (${selectedRoom._id})`
    );

    // 7️⃣ Maintenance check
    if (selectedRoom.status === "maintenance") {
      console.log(
        `⚠️ Room ${selectedRoom.roomNumber} is under maintenance`
      );

      return res.status(409).json({
        message: `Room ${selectedRoom.roomNumber} is under maintenance`,
      });
    }

    // 8️⃣ Check booking conflicts
    const conflict = await Booking.findOne({
      room: selectedRoom._id,
      status: { $in: ["reserved", "checked-in"] },
      checkInDate: { $lt: checkOut },
      checkOutDate: { $gt: checkIn },
    });

    if (conflict) {
      console.log(
        `❌ Room ${selectedRoom.roomNumber} already has a conflicting booking ${conflict._id}`
      );

      return res.status(409).json({
        message: `Room ${selectedRoom.roomNumber} is not available for the selected dates`,
      });
    }

    // 9️⃣ Calculate selected rate
  const pricing = calculateBookingTotal({
  room: selectedRoom,
  checkIn,
  checkOut,
});
    console.log("💰 Booking pricing:", pricing);

    // 🔟 Create booking
    const booking = await Booking.create({
      room: selectedRoom._id,
      roomNumber: selectedRoom.roomNumber,

      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,

      checkInDate: checkIn,
      checkOutDate: checkOut,

      handledBy: req.user._id,

      source: "reception",
      status: "reserved",

      // NEW PRICING SNAPSHOT
      rate_type: pricing.rateType,
applied_rate: pricing.rate,
total_charge: pricing.total,

pricingBreakdown: pricing.breakdown.map(
  (item) => ({
    date: item.date,
    rate_type: item.rateType,
    applied_rate: item.rate,
  })
),
    });

    console.log(
      `✅ Booking created successfully: Room ${selectedRoom.roomNumber}`
    );

    console.log(
      `💰 Rate: ${pricing.rateType} | ` +
      `Rate/night: ${pricing.rate} | ` +
      `Nights: ${pricing.nights} | ` +
      `Total: ${pricing.total}`
    );

    // 1️⃣1️⃣ Do not change room.status here
    return res.status(201).json({
      message: "Booking created successfully",
      booking,
      pricing: {
        rate_type: pricing.rateType,
        rate_per_night: pricing.rate,
        nights: pricing.nights,
        total_charge: pricing.total,
      },
    });
  } catch (error) {
    console.error("🔥 Error creating walk-in booking:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};


export const checkIn = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate("room");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    if (booking.status !== "reserved") {
      return res.status(400).json({
        message: "Booking not eligible for check-in",
      });
    }

    // =========================================================
    // DATE GUARD
    // =========================================================

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkInDate = new Date(booking.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);

    if (today < checkInDate) {
      return res.status(400).json({
        message: "Cannot check in before the reserved check-in date",
      });
    }

    // =========================================================
    // Ensure pricing exists
    // =========================================================

    if (
  !booking.pricingBreakdown?.length ||
  booking.total_charge === null ||
  booking.total_charge === undefined
) {
  await applyBookingPricing({
    booking,
    room,
  });

  await booking.save();
}

    // =========================================================
    // Create financial transaction
    // =========================================================

    const transaction = await createCheckInTransaction({
      booking,
      room: booking.room,
      staffId: req.user._id,
    });

    // =========================================================
    // Update booking
    // =========================================================

    booking.status = "checked-in";
    await booking.save();

    // =========================================================
    // Update room
    // =========================================================

    booking.room.status = "occupied";
    booking.room.lastUpdatedBy = req.user._id;
    booking.room.lastUpdatedAt = new Date();

    await booking.room.save();

    console.log(
      `💰 Revenue recorded: ${transaction.amount}`
    );

    return res.json({
      message: "Guest checked in successfully",
      booking,
      transaction,
    });
  } catch (error) {
    console.error("🔥 Check-in error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};



export const checkOut = async (req, res) => {
  try {
    const { bookingId } = req.params;

    // =========================================================
    // Find booking + room
    // =========================================================

    const booking = await Booking.findById(bookingId).populate("room");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // =========================================================
    // Must be checked-in
    // =========================================================

    if (booking.status !== "checked-in") {
      return res.status(400).json({
        message: "Booking not eligible for check-out",
      });
    }

    // =========================================================
    // Finalize financial transaction
    // =========================================================

    const transaction = await BookingTransaction.findOne({
      booking: booking._id,
    });

    if (transaction) {
      transaction.status = "CHECKED_OUT";
      transaction.checkOutAt = new Date();

      // IMPORTANT:
      // Do NOT change transaction.amount here.
      await transaction.save();
    }

    // =========================================================
    // Update booking
    // =========================================================

    booking.status = "checked-out";
    await booking.save();

    // =========================================================
    // Free room
    // =========================================================

    if (booking.room) {
      booking.room.status = "available";
      booking.room.lastUpdatedBy = req.user._id;
      booking.room.lastUpdatedAt = new Date();

      await booking.room.save();
    }

    return res.json({
      message: "Guest checked out successfully",
      booking,
      transaction,
    });
  } catch (error) {
    console.error("🔥 Check-out error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};


export const getAllBookings = async (req, res) => {
  try {
    const { range, date } = req.query;

    const now = dayjs().tz("Africa/Lagos");

    let start = null;
    let end = null;

    // ---------------------------
    // 1️⃣ Determine date range
    // ---------------------------

    if (date) {
      // 📅 SPECIFIC CALENDAR DATE
      //
      // Example:
      // /api/bookings?date=2026-09-18
      //
      // We use Lagos time so the selected calendar
      // date matches the hotel's local date.

      const selectedDate = dayjs.tz(date, "YYYY-MM-DD", "Africa/Lagos");

      if (!selectedDate.isValid()) {
        return res.status(400).json({
          message: "Invalid date. Expected format YYYY-MM-DD",
        });
      }

      start = selectedDate.startOf("day").toDate();
      end = selectedDate.endOf("day").toDate();
    } else {
      // Existing range filters remain unchanged

      switch (range) {
        case "today":
          start = now.startOf("day").toDate();
          end = now.endOf("day").toDate();
          break;

        case "this-week":
          start = now.startOf("week").toDate();
          end = now.endOf("week").toDate();
          break;

        case "this-month":
          start = now.startOf("month").toDate();
          end = now.endOf("month").toDate();
          break;

        case "this-year":
          start = now.startOf("year").toDate();
          end = now.endOf("year").toDate();
          break;
      }
    }

    // ---------------------------
    // 2️⃣ Build booking date filter
    // ---------------------------

    let bookingDateFilter = {};

   if (start && end) {
  bookingDateFilter = {
    checkInDate: { $gte: start, $lte: end },
  };
}

    // ---------------------------
    // 3️⃣ Fetch bookings
    // ---------------------------

    const bookings = await Booking.find(bookingDateFilter)
      .populate("room", "roomNumber roomType")
      .populate("handledBy", "fullName email")
      .sort({ createdAt: -1 });

    // ---------------------------
    // 4️⃣ Overview counts
    // ---------------------------

    const [
      totalRooms,
      activeBookings,
      checkedIn,
      checkedOut,
    ] = await Promise.all([
      // Keep your existing behavior
      Booking.countDocuments(),

      // Active bookings during selected period
      Booking.countDocuments({
        ...bookingDateFilter,
        status: { $in: ["reserved", "checked-in"] },
      }),

      // Checked-in bookings during selected period
      Booking.countDocuments({
        ...bookingDateFilter,
        status: "checked-in",
      }),

      // Checked-out bookings during selected period
      Booking.countDocuments({
        ...bookingDateFilter,
        status: "checked-out",
      }),
    ]);

    console.log("📅 Booking filter:", {
      range,
      date,
      start,
      end,
    });

    console.log("📊 Active bookings count:", activeBookings);
    console.log("📊 Checked-in count:", checkedIn);
    console.log("📊 Checked-out count:", checkedOut);

    // ---------------------------
    // 5️⃣ Send response
    // ---------------------------

    return res.json({
      bookings,
      overview: {
        totalRooms,
        activeBookings,
        checkedIn,
        checkedOut,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);

    return res.status(500).json({
      message: "Failed to fetch bookings",
    });
  }
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
      roomNumber,
    } = req.body;

    if (
      !guestFullName ||
      !guestPhone ||
      !numberOfGuests ||
      !checkInDate ||
      !checkOutDate
    ) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (
      isNaN(checkIn.getTime()) ||
      isNaN(checkOut.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid booking dates",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        error: "Invalid booking dates",
      });
    }

    let resolvedRoomNumber = null;
    let selectedRoom = null;

    // =========================================================
    // Resolve selected room if supplied
    // =========================================================

    if (roomNumber) {
      selectedRoom = await Room.findOne({
        roomNumber,
      });

      if (!selectedRoom) {
        return res.status(400).json({
          error: "Selected room not found",
        });
      }

      if (selectedRoom.status === "maintenance") {
        return res.status(409).json({
          error: "Selected room is under maintenance",
        });
      }

      const conflict = await Booking.findOne({
        roomNumber,
        status: {
          $in: ["pending", "confirmed", "reserved", "checked-in"],
        },
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      });

      if (conflict) {
        return res.status(409).json({
          error: "Selected room is not available for the chosen dates",
        });
      }

      resolvedRoomNumber = selectedRoom.roomNumber;
    }

    // =========================================================
    // Automatic online rate
    // =========================================================

    let pricing = null;

    if (selectedRoom) {
      pricing = calculateOnlineBookingPrice({
        room: selectedRoom,
        checkIn,
        checkOut,
      });

      console.log("🌐 Online booking pricing:", pricing);
    }

    // =========================================================
    // Create booking
    // =========================================================

    const booking = await Booking.create({
      guestFullName,
      guestEmail,
      guestPhone,
      numberOfGuests,

      checkInDate: checkIn,
      checkOutDate: checkOut,

      source: "online",
      status: "pending",

      room: null,
      roomNumber: resolvedRoomNumber,

      // If a room is already selected, save the pricing now.
      // If no room has been selected yet, confirmBooking()
      // will calculate it after room assignment.
      rate_type: pricing?.rateType || null,
      applied_rate: pricing?.rate || null,
      total_charge: pricing?.total || null,
    });

    await Notification.create({
      type: "ONLINE_BOOKING",
      booking: booking._id,
      message: `New online booking from ${booking.guestFullName}`,
    });

    return res.status(201).json({
      message: "Booking request received. Awaiting confirmation.",
      booking,
      pricing: pricing
        ? {
            rate_type: pricing.rateType,
            rate_per_night: pricing.rate,
            nights: pricing.nights,
            total_charge: pricing.total,
          }
        : null,
    });
  } catch (error) {
    console.error("ONLINE BOOKING ERROR:", error);

    return res.status(500).json({
      error: "Failed to create booking",
    });
  }
};



// Receptionist confirms a booking
export const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" })
    }

    /* -------------------- */
    /* Already processed?   */
    /* -------------------- */
    if (booking.status !== "pending") {
      return res.status(400).json({
        message: "Booking has already been processed",
      })
    }

    let room

    /* -------------------- */
    /* Use pre-selected room */
    /* -------------------- */
    if (booking.roomNumber) {
      room = await Room.findOne({ roomNumber: booking.roomNumber })

      if (!room) {
        return res.status(404).json({
          message: "Assigned room not found",
        })
      }
    } else {
      /* -------------------- */
      /* Auto-assign available room */
      /* -------------------- */
      const rooms = await Room.find({
        status: { $ne: "maintenance" },
      })

      for (const r of rooms) {
        const conflict = await Booking.findOne({
          _id: { $ne: booking._id },
          roomNumber: r.roomNumber,
          status: { $in: ["pending", "confirmed", "checked-in"] },
          checkInDate: { $lt: booking.checkOutDate },
          checkOutDate: { $gt: booking.checkInDate },
        })

        if (!conflict) {
          room = r
          break
        }
      }

      if (!room) {
        return res.status(409).json({
          message: "No rooms available for the selected dates",
        })
      }

      booking.roomNumber = room.roomNumber
    }

    /* -------------------- */
    /* Final conflict check */
    /* -------------------- */
    const overlapping = await Booking.findOne({
      _id: { $ne: booking._id },
      roomNumber: booking.roomNumber,
      status: { $in: ["pending", "confirmed", "checked-in"] },
      checkInDate: { $lt: booking.checkOutDate },
      checkOutDate: { $gt: booking.checkInDate },
    })

    if (overlapping) {
      return res.status(409).json({
        message: "Room is already booked for these dates",
      })
    }

    /* -------------------- */
    /* Confirm booking      */
    /* -------------------- */
    // =========================================================
// Finalize pricing after room assignment
// =========================================================

const pricing = await applyBookingPricing({
  booking,
  room,
});

console.log("💰 Confirmed booking pricing:", pricing);

// =========================================================
// Confirm booking
// =========================================================

booking.status = "reserved";
booking.room = room._id;
booking.roomNumber = room.roomNumber;
booking.handledBy = req.user._id;

await booking.save();

    /* -------------------- */
    /* Cleanup notification */
    /* -------------------- */
    await Notification.findOneAndDelete({ booking: booking._id })

    return res.json({
      message: "Booking confirmed successfully",
      booking,
    })
  } catch (error) {
    console.error("CONFIRM BOOKING ERROR:", error)
    return res.status(500).json({
      message: "Failed to confirm booking",
    })
  }
}



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

// PATCH /api/bookings/:bookingId/cancel
export const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).exec();

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // =========================================================
    // Prevent cancelling an already completed stay
    // =========================================================

    if (booking.status === "checked-out") {
      return res.status(400).json({
        message: "A checked-out booking cannot be canceled",
      });
    }

    if (booking.status === "canceled") {
      return res.status(400).json({
        message: "Booking is already canceled",
      });
    }

    // =========================================================
    // Update booking
    // =========================================================

    booking.status = "canceled";
    await booking.save();

    // =========================================================
    // Financial transaction
    // =========================================================

    const transaction = await BookingTransaction.findOne({
      booking: booking._id,
    });

    if (transaction) {
      transaction.status = "CANCELLED";
      transaction.cancelledAt = new Date();

      // IMPORTANT:
      // Keep the original amount for audit history.
      // Reports will exclude CANCELLED transactions.
      await transaction.save();
    }

    // =========================================================
    // Remove notification
    // =========================================================

    await Notification.findOneAndDelete({
      booking: booking._id,
    });

    return res.json({
      message: "Booking canceled successfully",
      booking,
      transaction,
    });
  } catch (err) {
    console.error("❌ Cancel booking error:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};



// Receptionist checks in a guest
// Receptionist checks in a guest
export const checkInBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    if (booking.status !== "reserved") {
      return res.status(400).json({
        error: `Cannot check-in. Booking status is "${booking.status}"`,
      });
    }

    const room = await Room.findById(booking.room);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    // =========================================================
    // Ensure pricing exists
    // =========================================================

    if (
  !booking.pricingBreakdown?.length ||
  booking.total_charge === null ||
  booking.total_charge === undefined
) {
  await applyBookingPricing({
    booking,
    room,
  });

  await booking.save();
}

    // =========================================================
    // Create financial transaction
    // =========================================================

    const transaction = await createCheckInTransaction({
      booking,
      room,
      staffId: req.user._id,
    });

    // =========================================================
    // Update booking
    // =========================================================

    booking.status = "checked-in";
    await booking.save();

    // =========================================================
    // Update room
    // =========================================================

    room.status = "occupied";
    room.lastUpdatedBy = req.user._id;
    room.lastUpdatedAt = new Date();

    await room.save();

    return res.json({
      message: "Guest checked-in successfully",
      booking,
      transaction,
    });
  } catch (error) {
    console.error("❌ Reception check-in error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// Receptionist checks out a guest
// Receptionist checks out a guest
export const checkOutBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    if (booking.status !== "checked-in") {
      return res.status(400).json({
        error: `Cannot check-out. Booking status is "${booking.status}"`,
      });
    }

    const room = await Room.findById(booking.room);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    // =========================================================
    // Finalize financial transaction
    // =========================================================

    const transaction = await BookingTransaction.findOne({
      booking: booking._id,
    });

    if (transaction) {
      transaction.status = "CHECKED_OUT";
      transaction.checkOutAt = new Date();

      // Do NOT modify transaction.amount.
      await transaction.save();
    }

    // =========================================================
    // Update booking
    // =========================================================

    booking.status = "checked-out";
    await booking.save();

    // =========================================================
    // Update room
    // =========================================================

    room.status = "available";
    room.lastUpdatedBy = req.user._id;
    room.lastUpdatedAt = new Date();

    await room.save();

    return res.json({
      message: "Guest checked-out successfully",
      booking,
      transaction,
    });
  } catch (error) {
    console.error("❌ Reception check-out error:", error);

    res.status(500).json({
      error: error.message,
    });
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

    const bookingIds = bookings.map(
  (booking) => booking._id
);

const transactions =
  await BookingTransaction.find({
    booking: { $in: bookingIds },
    status: {
      $ne: "CANCELLED",
    },
  });

const totalRevenue =
  transactions.reduce(
    (sum, transaction) =>
      sum + Number(transaction.total_charge || 0),
    0
  );

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



