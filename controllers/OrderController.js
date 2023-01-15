import * as dotenv from "dotenv";
import config from "config";
dotenv.config();
const { PRODUCTION, VER_CODE_LT: verificationCodeLT } = process.env;
const { dbConfig: dataBaseConfig, dbConfigProd: dataBaseConfigProduction } =
  config.get("dbConfig");
const { kaspi_url, pickupAdress } = config.get("kaspiConfig");
const production = PRODUCTION === "0" ? false : true;
import { validationResult } from "express-validator";
import mysql from "mysql2/promise";
import { customAlphabet } from "nanoid";
import {
  getNameByUID,
  sendNotificationEmail,
} from "../service/OrderService.js";
import axios from "axios";

export const createNewOrder = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const {
      goods,
      address,
      cellphone,
      is_pickup,
      deliveryPrice,
      sum,
      is_kaspi,
      comment,
      order_code,
    } = req.body;
    const { id, user_uid } = req.user;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await conn.end();
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const checkForUniqueOrderId = async () => {
      const nanoid = customAlphabet("1234567890", 8);
      const order_uid = nanoid();
      const sql1 = `SELECT * FROM orders WHERE uid = '${order_uid}'`;
      const sql2 = `SELECT * FROM finished_orders WHERE uid = '${order_uid}'`;
      const order_candidate = (await conn.query(sql1))[0][0];
      const finished_order_candidate = (await conn.query(sql2))[0][0];
      if (order_candidate || finished_order_candidate) {
        return await checkForUniqueOrderId();
      } else {
        return order_uid;
      }
    };
    const uid = await checkForUniqueOrderId();
    const sql3 = `SELECT uid, name, kaspi_token, permission FROM users WHERE id = ${id}`;
    const {
      uid: manager,
      name: managerName,
      kaspi_token,
      permission,
    } = (await conn.query(sql3))[0][0];
    if (permission === "false") {
      await conn.end();
      return res.status(400).json({ message: "Ошибка! Отказано в доступе." });
    }
    if (is_kaspi === "true") {
      const orders = await getOrders(user_uid, managerName, kaspi_token);
      if (orders.length === 0) {
        await conn.end();
        res.status(400).json({
          message: "В настоящее время у Вас нет заказов в Kaspi магазине.",
        });
        return;
      }
      for (let order of orders) {
        if (order_code === order.attributes.code) {
          const goods = await getEntries(
            user_uid,
            managerName,
            kaspi_token,
            order.relationships.entries.links.related
          );
          const address = order.attributes.deliveryAddress?.formattedAddress;
          await conn.query(`INSERT INTO orders SET ?`, {
            uid,
            goods,
            address: address ? address : `Самовывоз. ${pickupAdress}.`,
            cellphone: "+7" + order.attributes.customer?.cellPhone,
            is_pickup: (order.attributes.state === "PICKUP") + "",
            delivery_price_for_customer: 0,
            sum: order.attributes.totalPrice,
            status: "NEW",
            creation_date: new Date(order.attributes.creationDate),
            manager: user_uid,
            is_kaspi: "true",
            order_id: order.id,
            comment,
            order_code: order.attributes.code,
          });
          res.status(200).json({
            message: "Заказ найден и успешно создан!",
          });
          return;
        }
      }
      res.status(400).json({
        message: "Заказ не найден!",
      });
      return;
    }
    const sql4 = `INSERT INTO orders SET ?`;
    await conn.query(sql4, {
      uid,
      goods,
      address,
      cellphone,
      is_pickup,
      delivery_price_for_customer: deliveryPrice,
      sum,
      status: "NEW",
      creation_date: new Date(),
      manager,
      is_kaspi,
      comment,
      order_code,
    });
    sendNotificationEmail(
      "НОВЫЙ ЗАКАЗ!",
      "В магазин поступил новый заказ от <" + user_uid + ">.",
      { uid, address }
    );
    await conn.end();
    return res.status(200).json({
      message: "Новый заказ успешно создан!",
    });
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const editOrder = async (req, res) => {
  try {
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const {
      uid,
      goods,
      address,
      cellphone,
      is_pickup,
      deliveryPrice,
      sum,
      is_kaspi,
      comment,
      order_code,
    } = req.body;
    const { id } = req.user;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await conn.end();
      return res.status(400).json({ message: "Ошибка!", errors });
    }
    const sql4 = `UPDATE orders SET ? WHERE uid = ${uid}`;
    await conn.query(sql4, {
      goods,
      address,
      cellphone,
      is_pickup,
      delivery_price_for_customer: deliveryPrice,
      sum,
      is_kaspi,
      comment,
      order_code,
    });
    return res.status(200).json({
      message: "Заказ успешно отредатирован!",
    });
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.user;
    const sql1 = `SELECT * FROM orders WHERE status = "${status}"`;
    const sql2 = `SELECT uid FROM users WHERE id = ${id}`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    if (status === "MYDLVRS") {
      const deliver = (await conn.query(sql2))[0][0]["uid"];
      const result = (
        await conn.query(
          `SELECT * FROM orders WHERE status = "INDLVR" AND deliver = "${deliver}"`
        )
      )[0];
      await Promise.all(
        result.map(async (item) => {
          item.manager = await getNameByUID(item.manager);
          item.deliver = await getNameByUID(item.deliver);
          return item;
        })
      );
      await conn.end();
      return res.send(result);
    } else if (status === "PROCESS") {
      const result = (
        await conn.query(
          `SELECT * FROM orders WHERE status IN("PRFNSH", "PRCANC")`
        )
      )[0];

      await Promise.all(
        result.map(async (item) => {
          item.manager = await getNameByUID(item.manager);
          item.deliver = await getNameByUID(item.deliver);
          return item;
        })
      );
      await conn.end();
      return res.send(result);
    } else {
      const result = (await conn.query(sql1))[0];
      await Promise.all(
        result.map(async (item) => {
          item.manager = await getNameByUID(item.manager);
          item.deliver = await getNameByUID(item.deliver);
          return item;
        })
      );
      await conn.end();
      res.send(result);
    }
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const getFinishedOrders = async (req, res) => {
  try {
    const { first_date, second_date } = req.body;
    const sql1 = `SELECT * FROM finished_orders WHERE finished_date BETWEEN '${first_date}' AND '${second_date}'`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const result = (await conn.query(sql1))[0];
    await Promise.all(
      result.map(async (item) => {
        item.manager = await getNameByUID(item.manager);
        item.deliver = await getNameByUID(item.deliver);
        return item;
      })
    );
    await conn.end();
    res.send(result);
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { uid, isFinished } = req.body;
    const sql1 = `SELECT * FROM orders WHERE uid = "${uid}"`;
    const sql2 = `SELECT * FROM finished_orders WHERE uid = "${uid}"`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const result = (await conn.query(isFinished ? sql2 : sql1))[0][0];
    result.manager_uid = result.manager;
    result.manager = await getNameByUID(result.manager);
    result.deliver_uid = result.deliver;
    result.deliver = await getNameByUID(result.deliver);
    await conn.end();
    res.send(result);
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const getDelivers = async (req, res) => {
  try {
    const sql1 = `SELECT * FROM users`;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const delivers = (await conn.query(sql1))[0];
    const result = delivers.map((item) => {
      return { key: item.uid, value: item.name + ` (${item.uid})` };
    });
    await conn.end();
    res.send(result);
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const acceptOrder = async (req, res) => {
  try {
    const { role, uid } = req.user;
    if (role !== "admin") {
      return res.status(403).json({ message: "Отказано в доступе!" });
    }
    const { uids, deliver } = req.body;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const sql1 = `UPDATE orders SET status = "INDLVR", deliver = ${deliver} WHERE ?`;
    const sql2 = `UPDATE orders SET status = "INPICKUP" WHERE ?`;
    const sql3 = `SELECT status, is_pickup FROM orders WHERE ?`;
    let success = 0;
    await Promise.all(
      uids.map(async (item) => {
        const { status, is_pickup } = (
          await conn.query(sql3, { uid: item })
        )[0][0];
        if (status === "NEW" && is_pickup === "false") {
          await conn.query(sql1, { uid: item });
          success++;
        } else if (status === "NEW" && is_pickup === "true") {
          await conn.query(sql2, { uid: item });
          success++;
        }
      })
    );
    await conn.end();
    res.status(200).json({ message: `(${success})` });
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

export const processOrder = async (req, res) => {
  try {
    const { user_uid, role } = req.user;
    const { uid, operation } = req.body;
    const conn = await mysql.createConnection(
      production ? dataBaseConfigProduction : dataBaseConfig
    );
    const sql1 = `SELECT * FROM orders WHERE ?`;
    const order = (await conn.query(sql1, { uid }))[0][0];

    if (order.status === "NEW") {
      if (operation === "cancel") {
        if (user_uid !== order.manager) {
          if (role !== "admin") {
            await conn.end();
            return res.status(403).json({ message: "Отказано в доступе!" });
          }
        }
        const sql13 = `DELETE FROM orders WHERE uid = ${uid}`;
        await conn.query(sql13);
        await conn.end();
        return res.status(200).json({ message: `(${uid})` });
      }
    }

    if (order.deliver !== user_uid) {
      if (role !== "admin") {
        await conn.end();
        return res.status(403).json({ message: "Отказано в доступе!" });
      }
    }

    if (order.status === "INDLVR") {
      let finalStatus = "";
      if (operation === "cancel") {
        finalStatus = "PRCANC";
      } else if (operation === "finish") {
        finalStatus = "PRFNSH";
      } else if (operation === "recreate") {
        const sql2 = `UPDATE orders SET status = "PRCANC" WHERE uid = ${uid}`;
        const sql3 = `INSERT INTO orders SET ?, status = "NEW"`;
        await conn.query(sql2);
        const checkForUniqueOrderId = async () => {
          const nanoid = customAlphabet("1234567890", 8);
          const order_uid = nanoid();
          const sql4 = `SELECT * FROM orders WHERE uid = '${order_uid}'`;
          const sql5 = `SELECT * FROM finished_orders WHERE uid = '${order_uid}'`;
          const order_candidate = (await conn.query(sql4))[0][0];
          const finished_order_candidate = (await conn.query(sql5))[0][0];
          if (order_candidate || finished_order_candidate) {
            return await checkForUniqueOrderId();
          } else {
            return order_uid;
          }
        };
        const new_uid = await checkForUniqueOrderId();
        await conn.query(sql3, {
          uid: new_uid,
          goods: order.goods,
          address: order.address,
          cellphone: order.cellphone,
          is_pickup: order.is_pickup,
          delivery_price_for_customer: order.delivery_price_for_customer,
          sum: order.sum,
          creation_date: new Date(),
          manager: order.manager,
          is_kaspi: order.is_kaspi,
          comment: order.comment,
          order_code: order.order_code,
        });
        await conn.end();
        return res.status(200).json({ message: `(${uid})` });
      }
      const sql6 = `UPDATE orders SET ? WHERE uid = ${uid}`;
      await conn.query(sql6, { status: finalStatus });
      await conn.end();
      return res.status(200).json({ message: `(${uid})` });
    }

    if (role !== "admin") {
      await conn.end();
      return res.status(403).json({ message: "Отказано в доступе!" });
    }

    if (order.status === "INPICKUP") {
      if (operation === "cancel") {
        const sql7 = `DELETE FROM orders WHERE uid = ${uid}`;
        await conn.query(sql7);
        await conn.end();
        return res.status(200).json({ message: `(${uid})` });
      } else if (operation === "finish") {
        const sql8 = `INSERT INTO finished_orders SET ?`;
        await conn.query(sql8, {
          uid,
          goods: order.goods,
          address: order.address,
          cellphone: order.cellphone,
          is_pickup: order.is_pickup,
          delivery_price_for_customer: order.delivery_price_for_customer,
          sum: order.sum,
          status: "FDPICKUP",
          creation_date: order.creation_date,
          finished_date: new Date(),
          manager: order.manager,
          deliver: order.deliver,
          is_kaspi: order.is_kaspi,
          comment: order.comment,
          order_code: order.order_code,
        });
        const sql9 = `DELETE FROM orders WHERE uid = ${uid}`;
        await conn.query(sql9);
        await conn.end();
        return res.status(200).json({ message: `(${uid})` });
      }
    } else if (order.status === "PRCANC") {
      const sql10 = `DELETE FROM orders WHERE uid = ${uid}`;
      await conn.query(sql10);
      await conn.end();
      return res.status(200).json({ message: `(${uid})` });
    } else if (order.status === "PRFNSH") {
      const sql11 = `INSERT INTO finished_orders SET ?`;
      await conn.query(sql11, {
        uid,
        goods: order.goods,
        address: order.address,
        cellphone: order.cellphone,
        is_pickup: order.is_pickup,
        delivery_price_for_customer: order.delivery_price_for_customer,
        sum: order.sum,
        status: "FDDLVR",
        creation_date: order.creation_date,
        finished_date: new Date(),
        manager: order.manager,
        deliver: order.deliver,
        is_kaspi: order.is_kaspi,
        comment: order.comment,
        order_code: order.order_code,
      });
      const sql12 = `DELETE FROM orders WHERE uid = ${uid}`;
      await conn.query(sql12);
      await conn.end();
      return res.status(200).json({ message: `(${uid})` });
    }
    await conn.end();
    res.status(400).json({ message: `(${uid})` });
  } catch (e) {
    res.status(500).json({ message: "Ошибка сервера: " + e });
  }
};

const getOrders = async (uid, name, api_token) => {
  try {
    const delivery = await axios.get(kaspi_url + "/shop/api/v2/orders", {
      headers: {
        "Content-Type": "application/vnd.api+json",
        "X-Auth-Token": api_token,
      },
      params: {
        "page[number]": 0,
        "page[size]": 100,
        "filter[orders][state]": "DELIVERY",
        "filter[orders][creationDate][$ge]":
          Date.now() - 14 * 24 * 60 * 60 * 1000,
      },
    });
    const pickup = await axios.get(kaspi_url + "/shop/api/v2/orders", {
      headers: {
        "Content-Type": "application/vnd.api+json",
        "X-Auth-Token": api_token,
      },
      params: {
        "page[number]": 0,
        "page[size]": 100,
        "filter[orders][state]": "PICKUP",
        "filter[orders][creationDate][$ge]":
          Date.now() - 14 * 24 * 60 * 60 * 1000,
      },
    });
    const filteredPickup = pickup.data.data.filter(
      (item) => !item.attributes.isKaspiDelivery
    );
    return [...delivery.data.data, ...filteredPickup];
  } catch (e) {
    console.log(
      `<${uid}>${name}: Ошибка!`,
      e.response?.data?.message ? e.response?.data?.message : e.message
    );
    return [];
  }
};

const getEntries = async (uid, name, api_token, link) => {
  try {
    const { data: result } = await axios.get(link, {
      headers: {
        "Content-Type": "application/vnd.api+json",
        "X-Auth-Token": api_token,
      },
    });
    const array = [];
    await Promise.all(
      result.data.map(async (item) => {
        array.push({
          goodName: (
            await axios.get(item.relationships.product.links.related, {
              headers: {
                "Content-Type": "application/vnd.api+json",
                "X-Auth-Token": api_token,
              },
            })
          ).data.data.attributes.name,
          quantity: item.attributes.quantity,
        });
      })
    );
    let str = "";
    array.forEach((item) => {
      str += item.quantity + "шт. " + item.goodName;
    });
    return str;
  } catch (e) {
    console.log(
      `<${uid}>${name}: Ошибка!`,
      e.response?.data?.message ? e.response?.data?.message : e.message
    );
  }
};
