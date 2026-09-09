import mongoose from "mongoose";

const bookingTransactionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },

    guestFullName: {
      type: String,
      required: true,
    },

    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },

    roomNumber: {
      type: String,
      default: null,
    },

    roomType: {
      type: String,
      default: null,
    },

    rate_type: {
      type: String,
      enum: ["WEEKDAY", "WEEKEND"],
      default: null,
    },

    total_charge: {
  type: Number,
  min: 0,
  default: null,
},

// =====================================
// PER-NIGHT PRICING SNAPSHOT
// =====================================

pricingBreakdown: [
  {
    date: {
      type: Date,
      required: true,
    },

    rate_type: {
      type: String,
      enum: ["WEEKDAY", "WEEKEND"],
      required: true,
    },

    applied_rate: {
      type: Number,
      min: 0,
      required: true,
    },
  },
],
    source: {
      type: String,
      enum: ["online", "reception"],
      required: true,
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELLED",
      ],
      required: true,
    },

    checkInAt: {
      type: Date,
      default: null,
    },

    checkOutAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "BookingTransaction",
  bookingTransactionSchema
);