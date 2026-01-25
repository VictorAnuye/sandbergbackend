import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    console.log("📧 SMTP Config:", {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS ? "Loaded ✅" : "❌ Missing",
    });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // IMPORTANT
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // MUST be App Password
      },
    });

    const info = await transporter.sendMail({
      from: `"Sandberg Guest House" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log("✅ Email sent:", info.messageId);
    return true;

  } catch (error) {
    console.error("❌ SMTP error:", error);
    throw new Error("Email delivery failed");
  }
};
