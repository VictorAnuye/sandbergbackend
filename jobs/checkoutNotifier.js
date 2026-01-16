import cron from "node-cron"
import { notifyCheckoutDueBookings } from "../controllers/notificationController.js"

export const startCheckoutNotifierJob = () => {
  // Runs every day at 6am
  cron.schedule("0 6 * * *", async () => {
    console.log("⏰ Running checkout due notification job")
    await notifyCheckoutDueBookings()
  })
}