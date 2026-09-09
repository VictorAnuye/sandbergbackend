import express from "express";
import cors from "cors";
import roomRoutes from "./routes/roomRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
// import { startCheckoutNotifierJob } from "./jobs/checkoutNotifier.js"
const app = express(); 

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);  
app.use("/api/bookings", bookingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
const allowedOrigins = [
  "http://localhost:3000",
  "https://prd-review-2-4.v0.build",
];
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin
      // such as Postman or server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "HEAD",
      "PUT",
      "PATCH",
      "POST",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);
app.options("*", cors());
app.get("/", (req, res) => {
  res.json({ message: "Sandberg HMS API running" });
});

// startCheckoutNotifierJob()

export default app;
