// src/utils/sendEmail.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, text) => {
  try {
    console.log(`Preparing to send email to: ${to}`);
    
    const transporter = nodemailer.createTransport({
      service: "gmail", // or your SMTP service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify connection configuration
    await transporter.verify();
    console.log("Email server connection successful");

    const mailOptions = {
      from: `"Sandberg Guest House" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
    console.log("Message ID:", info.messageId);
    console.log("Preview URL (if available):", nodemailer.getTestMessageUrl(info));

  } catch (error) {
    console.error("Error sending email:", error);
  }
};
