import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION, VER_CODE_LT: verificationCodeLT } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const production = PRODUCTION === "0" ? false : true;
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import mysql from "mysql2/promise";
import { customAlphabet } from "nanoid";
import { sendConfirmationEmail } from "../service/AuthService.js";

const generateAccesToken = (id, role, user_uid) => {
  const payload = {
    id,
    role,
    user_uid,
  };
  return jwt.sign(payload, process.env.SECRET_KEY, {
    expiresIn: process.env.LOGIN_TOKEN_LT,
  });
};

export const login = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { email, password } = req.body;
    const errors = validationResult(req);
    const sql = `SELECT * FROM users WHERE email = '${email}'`;
    const user = (await conn.query(sql))[0][0];
    if (!errors.isEmpty()) {
      await conn.end();
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    if (!user) {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Пользователь с таким E-mail не найден." });
    }
    const isPassValid = bcrypt.compareSync(password, user.password);
    if (!isPassValid) {
      await conn.end();
      return res.status(400).json({ message: "Неверный пароль." });
    }
    if (user.verified === "false") {
      await conn.end();
      return res
        .status(200)
        .json({ message: "Пожалуйста, подтвердите ваш E-mail!", email });
    }
    const token = generateAccesToken(user.id, user.role, user.uid);
    return res.json({
      token,
      user: {
        id: user.id + "",
        uid: user.uid + "",
        email: user.email + "",
        name: user.name + "",
        role: user.role + "",
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const registration = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const errors = validationResult(req);
    const { email, name, password } = req.body;
    const sql = `SELECT * FROM users WHERE email = '${email}'`;
    const sql2 = `INSERT INTO users SET ?`;
    const candidate = (await conn.query(sql))[0][0];
    if (!errors.isEmpty()) {
      await conn.end();
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    if (candidate) {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Пользователь с таким e-mail уже существует." });
    } else {
      const checkForUniqueUserId = async () => {
        const nanoid = customAlphabet("1234567890", 8);
        const user_id = nanoid();
        const sql4 = `SELECT * FROM users WHERE uid = '${user_id}'`;
        const user_candidate = (await conn.query(sql4))[0][0];
        if (user_candidate) {
          return await checkForUniqueUserId();
        } else {
          return user_id;
        }
      };

      const uid = await checkForUniqueUserId();

      const hashPassword = await bcrypt.hash(password, 5);

      const nanoidForConfirmationCode = customAlphabet(
        "1234567890abcdefghijklmnopqrstuvwxyz",
        7
      );
      const confirmationcCode = nanoidForConfirmationCode();
      sendConfirmationEmail(name, email, confirmationcCode);

      await conn.query(sql2, {
        email: email.toLowerCase(),
        name,
        role: "user",
        uid,
        cdate: Date.now().toString(),
        confirm: confirmationcCode,
        password: hashPassword,
        kaspi_token: "",
        verified: "false",
        notifications: "false",
      });
      await conn.end();

      return res
        .json({
          message:
            "Пользователь успешно зарегистрирован. Код для подтверждения отправлен вам на E-Mail!",
        })
        .status(200);
    }
  } catch (e) {
    res.status(500).json({ message: "Server error: " + e });
  }
};

export const confirmAccount = async (req, res) => {
  try {
    const { code, email } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const sql = `SELECT * FROM users WHERE email = "${email}"`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const candidate = (await conn.query(sql))[0][0];
    if (!candidate) {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Пользователь с таким e-mail не существует!" });
    }
    if (candidate.verified !== "false") {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Аккаунт с таким E-mail уже активирован!" });
    }
    if (candidate.confirm !== code) {
      await conn.end();
      return res.status(400).json({ message: "Неверный код!" });
    }
    const sql2 = `UPDATE users SET ? WHERE id = ${candidate.id}`;
    await conn.query(sql2, { verified: "true" });
    res.status(200).json({ message: "Аккаунт успешно подтвержден!" });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const sendCodeToRestoreTheAccount = async (req, res) => {
  try {
    const { email } = req.body;
    const cdate = Date.now().toString();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const nanoidForConfirmationCode = customAlphabet(
      "1234567890abcdefghijklmnopqrstuvwxyz",
      7
    );
    const confirmationCode = nanoidForConfirmationCode();
    const sql = `SELECT * FROM users WHERE ?`;
    const sql2 = `UPDATE users SET ? WHERE email = "${email}"`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const candidate = (await conn.query(sql, { email }))[0][0];
    if (!candidate) {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Пользователь с таким e-mail не существует!" });
    }
    if (Date.now() - parseInt(candidate.cdate) < verificationCodeLT) {
      await conn.end();
      const nextCodeTime =
        verificationCodeLT - (Date.now() - parseInt(candidate.cdate));
      const minutes = Math.floor(nextCodeTime / 60000);
      const seconds = Math.floor((nextCodeTime - minutes * 60000) / 1000);
      return res.status(400).json({
        message: `Новый код можно будет отправить только через ${
          minutes !== 0 ? minutes + " минуты и " : ""
        }${seconds} секунд.`,
      });
    }
    sendConfirmationEmail(candidate.name, email, confirmationCode);
    await conn.query(sql2, { confirm: confirmationCode, cdate });
    res.status(200).json({ message: "Код успешно отправлен на ваш E-mail!" });
    conn.end();
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { code, email, password } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const sql = `SELECT * FROM users WHERE email = "${email}"`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const candidate = (await conn.query(sql))[0][0];
    const hashPassword = await bcrypt.hash(password, 5);
    const nanoidForConfirmationCode = customAlphabet(
      "1234567890abcdefghijklmnopqrstuvwxyz",
      7
    );
    const confirmationCode = nanoidForConfirmationCode();
    if (!candidate) {
      await conn.end();
      return res
        .status(400)
        .json({ message: "Пользователь с таким e-mail не существует!" });
    }
    if (candidate.confirm !== code) {
      conn.end();
      return res.status(400).json({ message: "Неверный код!" });
    }
    const sql2 = `UPDATE users SET ? WHERE id = ${candidate.id}`;
    await conn.query(sql2, {
      password: hashPassword,
      confirm: confirmationCode,
    });
    res.status(200).json({ message: "Пароль успешно сменился!" });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const { id } = req.user;
    const sql = `SELECT * FROM users WHERE id = ${id}`;
    const sql2 = `DELETE FROM users WHERE id = ${id}`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const user = (await conn.query(sql))[0][0];
    await conn.query(sql2);
    res.status(200).json({ message: "Аккаунт успешно удален!" });
    conn.end();
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const { id } = req.user;
    const sql = `SELECT * FROM users WHERE id = ${id}`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const user = (await conn.query(sql))[0][0];
    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        uid: user.uid,
        role: user.role,
        token: user.kaspi_token,
        notifications: user.notifications,
      },
    });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const getAPIToken = async (req, res) => {
  try {
    const { uid } = req.body;
    const sql = `SELECT kaspi_token FROM users WHERE uid = ${uid}`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const { kaspi_token } = (await conn.query(sql))[0][0];
    res.status(200).json({
      token: kaspi_token,
    });
    conn.end();
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const editAccount = async (req, res) => {
  try {
    const { id } = req.user;
    const errors = validationResult(req);
    const { name, kaspi_token } = req.body;
    const sql = `SELECT * FROM users WHERE id = ${id}`;
    const sql2 = `UPDATE users SET ? WHERE id = ${id}`;
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const user = (await conn.query(sql))[0][0];
    if (!user) {
      await conn.end();
      return res.status(400).json({
        message: `Ошибка! Пользователя с ID = "${id}" не существует.`,
      });
    }
    await conn.query(sql2, { name, kaspi_token });
    res.status(200).json({ message: "Аккаунт успешно обновлен." });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};

export const toggleNotifications = async (req, res) => {
  try {
    const { id } = req.user;
    const { boo } = req.body;
    const sql1 = `SELECT notifications FROM users WHERE id = ${id}`;
    const sql2 = `UPDATE users SET ? WHERE id = ${id}`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const user = (await conn.query(sql1))[0][0];
    if (!user) {
      await conn.end();
      return res.status(400).json({
        message: `Ошибка! Пользователя с ID = "${id}" не существует.`,
      });
    }
    await conn.query(sql2, { notifications: boo });
    res.status(200).json({ message: "Аккаунт успешно обновлен." });
    conn.end();
  } catch (e) {
    res.status(500).json({ message: "Ошибка! " + e });
  }
};
