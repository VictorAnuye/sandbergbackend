import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
    console.log("🗄️ DB name:", mongoose.connection.name);
    console.log("🌍 DB host:", mongoose.connection.host);
  } catch (error) {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
  }
};

export default connectDB;
