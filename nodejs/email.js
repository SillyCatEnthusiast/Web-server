// const nodemailer = require("nodemailer");
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT),
//   secure: process.env.SMTP_SECURE === "true",
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
//   connectionTimeout: 20000,
//   greetingTimeout: 20000,
//   socketTimeout: 20000,
// });

// transporter.verify((err, success) => {
//   if (err) console.log("SMTP verify failed:", err);
//   else console.log("SMTP server is ready");
// });

// async function sendEmail(to, subject, text) {
//   try {
//     const info = await transporter.sendMail({
//       from: process.env.SMTP_USER,
//       to,
//       subject,
//       text,
//     });
//     console.log("Email sent:", info.messageId);
//     return true;
//   } catch (error) {
//     console.log("Email send failed:", error);
//     return false;
//   }
// }

// module.exports = { sendEmail };
