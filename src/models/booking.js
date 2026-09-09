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

    checkoutNotified: {
      type: Boolean,
      default: false,
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

    rate_type: {
  type: String,
  enum: ["WEEKDAY", "WEEKEND"],
  default: null,
},

applied_rate: {
  type: Number,
  min: 0,
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
