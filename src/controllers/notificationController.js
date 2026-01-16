import Notification from "../models/notification.js";
import Booking from "../models/booking.js"
import User from "../models/user.js"

export const notifyCheckoutDueBookings = async () => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1️⃣ Find bookings due for checkout
    const dueBookings = await Booking.find({
      checkOutDate: { $lte: today },
      status: "checked-in",
      checkoutNotified: false,
    }).populate("room")

    if (!dueBookings.length) {
      console.log("ℹ️ No checkout-due bookings found")
      return
    }

    // 2️⃣ Create notifications
    for (const booking of dueBookings) {
      await Notification.create({
        type: "CHECKOUT_DUE",
        booking: booking._id,
        message: `Room ${booking.roomNumber || booking.room?.roomNumber} is due for checkout today.`,
        createdBy: "SYSTEM",
      })

      // 3️⃣ Prevent duplicate notifications
      booking.checkoutNotified = true
      await booking.save()
    }

    console.log(`✅ Checkout notifications sent for ${dueBookings.length} booking(s)`)
  } catch (error) {
    console.error("❌ Checkout notification error:", error)
  }
}

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate("booking")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// controllers/notificationController.js

export const getNotificationCount = async (req, res) => {
  try {
    // Count bookings that are "Reserved" (pending check-in)
    const count = await Booking.countDocuments({ status: "Reserved" })
    res.status(200).json({ count })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
}
