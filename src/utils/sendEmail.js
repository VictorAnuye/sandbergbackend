import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, text) => {
  try {
    console.log(`Preparing to send email to: ${to}`);

    const { data, error } = await resend.emails.send({
      from: `Sandberg Guest House <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error("Email delivery failed");
    }

    console.log("Email sent successfully");
    console.log("Resend ID:", data.id);

    return true;
  } catch (err) {
    console.error("Error sending email:", err.message);
    throw err; // 🔥 IMPORTANT — let controller know it failed
  }
};
