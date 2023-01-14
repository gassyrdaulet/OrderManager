import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION, VER_CODE_LT: verificationCodeLT } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const production = PRODUCTION === "0" ? false : true;
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  service: "Mail.ru",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const getNameByUID = async (uid) => {
  try {
    if (uid === null) {
      return "Нет";
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const sql1 = `SELECT name FROM users WHERE uid = ${uid}`;
    const { name } = (await conn.query(sql1))[0][0];
    await conn.end();
    return name;
  } catch (e) {
    return uid;
  }
};

export const sendNotificationEmail = async (title, desc, order) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const sql1 = `SELECT email FROM users WHERE notifications = "true"`;
    const emails = (await conn.query(sql1))[0];
    await Promise.all(
      emails.map(async (item) => {
        transport.sendMail({
          from: process.env.EMAIL_SENDER,
          to: item.email,
          subject: "УВЕДОМЛЕНИЕ ОТ ORDERMANAGER",
          html: `<h1>${title}</h1>
            <p>${desc}</p>
            <center><h1>${"UID: " + order.uid}<br/>${
            "Адрес: " + order.address
          }</h1></center>
            </div>`,
        });
      })
    );
  } catch (e) {
    console.log(e);
  }
};
