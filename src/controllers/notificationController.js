import Notification from "../models/notification.js";

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
import Booking from "../models/booking.js"

export const getNotificationCount = async (req, res) => {
  try {
    // Count bookings that are "Reserved" (pending check-in)
    const count = await Booking.countDocuments({ status: "Reserved" })
    res.status(200).json({ count })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
}
