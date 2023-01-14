import * as dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  service: "Mail.ru",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendConfirmationEmail = (name, email, confirmationCode) => {
  transport
    .sendMail({
      from: process.env.EMAIL_SENDER,
      to: email,
      subject: "Please confirm your account",
      html: `<h1>Подтверждение E-mail</h1>
          <h2>Привет, ${name}!</h2>
          <p>Привет. Спасибо за регистрацию! Пожалуйста подтвердите ваш аккаунт, нужно ввести этот код.</p>
          <center><h1>${confirmationCode}</h1></center>
          </div>`,
    })
    .catch((err) => console.log(err));
};
