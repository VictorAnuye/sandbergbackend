import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, "Room number is required"],
      unique: true,
      trim: true,
    },
    roomType: {
      type: String,
      enum: ["Single", "Double", "Deluxe", "Suite"],
      default: "Single",
    },
    pricePerNight: {
      type: Number,
      required: [true, "Price per night is required"],
      min: [0, "Price cannot be negative"],
    },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "maintenance"],
      default: "available",
    },
    description: {
      type: String,
      trim: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Who last updated the status
    },
    lastUpdatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
  
);

export default mongoose.model("Room", roomSchema);
