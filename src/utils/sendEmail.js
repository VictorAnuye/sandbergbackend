import axios from "axios";

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Sandberg Guesthouse",
          email: "no-reply@sandberghotel.com", // can be any verified sender
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.SMTP_PASS,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ Email sent via Brevo API:", response.data);
    return true;
  } catch (error) {
    console.error(
      "❌ Brevo API Email Error:",
      error.response?.data || error.message
    );
    return false;
  }
};
