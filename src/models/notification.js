import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ONLINE_BOOKING"],
      required: true,
    },

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    createdBy: {
      type: String,
      enum: ["SYSTEM"],
      default: "SYSTEM",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
