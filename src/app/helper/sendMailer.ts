import nodemailer from 'nodemailer';
import config from '../config';

const port = Number(config.email.port) || 587;
const secure = port === 465 || config.email.security === 'true';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port,
  secure,
  requireTLS: !secure,
  auth: {
    user: config.email.address,
    pass: config.email.pass,
  },
});

const sendMailer = async (email: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: `"Meet Elysia" <${config.email.from || config.email.address}>`,
      to: email,
      subject,
      html,
    });

    console.log('Message sent:', info.messageId);

    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
};

export default sendMailer;
