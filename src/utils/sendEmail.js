import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // MUST be false for 587
  auth: {
    user: "apikey",
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // important on Render
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });

    console.log("✅ Email sent successfully via Brevo SMTP");
  } catch (error) {
    console.error("❌ Brevo SMTP error:", error);
    throw new Error("Email delivery failed");
  }
};
