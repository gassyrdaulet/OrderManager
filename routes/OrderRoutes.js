import { Router } from "express";
import { check } from "express-validator";
import { auth } from "../middleware/RouterSecurity.js";
import {
  createNewOrder,
  getAllOrders,
  getOrder,
  getDelivers,
  acceptOrder,
  processOrder,
  getFinishedOrders,
  editOrder,
} from "../controllers/OrderController.js";

const router = new Router();

router.post(
  "/new",
  [
    auth,
    check(
      "goods",
      "Поле товаров не должно быть пустым или превышать 500 символов"
    ).isLength({ min: 1, max: 500 }),
    check(
      "address",
      "Поле адреса не должно быть пустым или превышать 500 символов"
    ).isLength({ min: 1, max: 500 }),
    check(
      "cellphone",
      "Поле номера телефона не должно быть пустым или превышать 50 символов"
    ).isLength({ min: 1, max: 50 }),
    check("cellphone", "Неверный формат у поля номера телефона.").isMobilePhone(
      "kk-KZ"
    ),
    check(
      "deliveryPrice",
      "Неверный формат числа у поля стоимости доставки."
    ).custom((value) => !isNaN(value)),
    check(
      "deliveryPrice",
      "Стоимость доставки не должна быть меньше 0 или больше 100000"
    ).custom((value) => value >= 0 || value < 100000),
    check("sum", "Неверный формат числа у поля суммы.").custom(
      (value) => !isNaN(value)
    ),
    check("sum", "Сумма не должна быть меньше 0 или больше 1000000000").custom(
      (value) => value < 1000000000 || value >= 0
    ),
    check(
      "comment",
      "Поле комментария не должно превышать 500 символов"
    ).isLength({ max: 500 }),
    check(
      "order_code",
      "Поле номера заказа не должно превышать 10 символов"
    ).isLength({ min: 0, max: 10 }),
  ],
  createNewOrder
);
router.post(
  "/edit",
  [
    auth,
    check(
      "goods",
      "Поле товаров не должно быть пустым или превышать 500 символов"
    ).isLength({ min: 1, max: 500 }),
    check(
      "address",
      "Поле адреса не должно быть пустым или превышать 500 символов"
    ).isLength({ min: 1, max: 500 }),
    check(
      "cellphone",
      "Поле номера телефона не должно быть пустым или превышать 50 символов"
    ).isLength({ min: 1, max: 50 }),
    check("cellphone", "Неверный формат у поля номера телефона.").isMobilePhone(
      "kk-KZ"
    ),
    check(
      "deliveryPrice",
      "Неверный формат числа у поля стоимости доставки."
    ).custom((value) => !isNaN(value)),
    check(
      "deliveryPrice",
      "Стоимость доставки не должна быть меньше 0 или больше 100000"
    ).custom((value) => value >= 0 || value < 100000),
    check("sum", "Неверный формат числа у поля суммы.").custom(
      (value) => !isNaN(value)
    ),
    check("sum", "Сумма не должна быть меньше 0 или больше 1000000000").custom(
      (value) => value < 1000000000 || value >= 0
    ),
    check(
      "comment",
      "Поле комментария не должно превышать 500 символов"
    ).isLength({ max: 500 }),
    check(
      "order_code",
      "Поле номера заказа не должно превышать 10 символов"
    ).isLength({ min: 0, max: 10 }),
  ],
  editOrder
);
router.post("/get", auth, getAllOrders);
router.post("/getfinished", auth, getFinishedOrders);
router.post("/details", auth, getOrder);
router.post("/delivers", auth, getDelivers);
router.post("/accept", auth, acceptOrder);
router.post("/process", auth, processOrder);

export default router;
