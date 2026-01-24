import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, html) => {
  console.log("📧 SMTP Config:", {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? "Loaded ✅" : "❌ Missing",
  });

  const transporter = nodemailer.createTransport({
    service: "gmail", // 👈 THIS is the key
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password
    },
  });

  await transporter.sendMail({
    from: `"Sandberg Guest House" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  console.log("✅ Email sent via Gmail");
};
