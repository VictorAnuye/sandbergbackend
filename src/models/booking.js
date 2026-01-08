import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null, // initially null for pending bookings
    },

    roomNumber: {
      type: String,
      default: null, // store human-readable room number for receptionist
    },

    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // receptionist
      default: null,
    },

    source: {
      type: String,
      enum: ["online", "reception"],
      required: true,
    },

    guestFullName: {
      type: String,
      required: true,
      trim: true,
    },

    guestEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    guestPhone: {
      type: String,
      required: true,
      trim: true,
    },

    numberOfGuests: {
      type: Number,
      required: true,
      min: 1,
    },

    checkInDate: {
      type: Date,
      required: true,
    },

    checkOutDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "reserved",
        "checked-in",
        "checked-out",
        "canceled",
      ],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
