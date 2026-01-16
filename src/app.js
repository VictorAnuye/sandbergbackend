import express from "express";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
// import { startCheckoutNotifierJob } from "./jobs/checkoutNotifier.js"
const app = express(); 

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);  
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}))
app.get("/", (req, res) => {
  res.json({ message: "Sandberg HMS API running" });
});

// startCheckoutNotifierJob()

export default app;
