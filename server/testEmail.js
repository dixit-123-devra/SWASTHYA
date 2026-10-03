require('dotenv').config({ path: './.env' });
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log("SMTP_EMAIL:", process.env.SMTP_EMAIL);
  console.log("SMTP_PASSWORD:", process.env.SMTP_PASSWORD ? "***" : "MISSING");
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Swasthya Healthcare" <${process.env.SMTP_EMAIL}>`,
      to: process.env.SMTP_EMAIL, // sending to self to test
      subject: 'Test Email',
      text: `This is a test email`
    };

    console.log("Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:");
    console.error(error);
  }
}

testEmail();
