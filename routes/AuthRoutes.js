import { Router } from "express";
import { check } from "express-validator";
import {
  login,
  registration,
  confirmAccount,
  sendCodeToRestoreTheAccount,
  changePassword,
  deleteAccount,
  getUserInfo,
  editAccount,
  getAPIToken,
  toggleNotifications,
} from "../controllers/AuthController.js";
import { auth } from "../middleware/RouterSecurity.js";

const router = new Router();

router.post(
  "/registration",
  [
    check("email", "Некорректный E-mail!").isEmail(),
    check("password", "Пароль должен быть длиннее 9 и короче 20!")
      .isLength({
        min: 9,
        max: 20,
      })
      .isStrongPassword({ minLength: 0, minSymbols: 0 })
      .withMessage(
        "Пароль должен иметь как минимум одно число, одну заглавную и одну прописную букву."
      ),
    check("name", "Имя должно быть длиннее 1 и короче 20!").isLength({
      min: 1,
      max: 20,
    }),
  ],
  registration
);
router.post(
  "/login",
  [
    check("email", "Некорректный E-mail!").isEmail(),
    check("password", "Пароль должен быть длиннее 9 и короче 20!").isLength({
      min: 9,
      max: 20,
    }),
  ],
  login
);
router.post(
  "/confirm",
  [
    check("email", "Неверный формат E-mail!").isEmail(),
    check("code", "Код не должен быть короче 1 и длиннее 8!").isLength({
      min: 1,
      max: 8,
    }),
  ],
  confirmAccount
);
router.post(
  "/restore",
  [check("email", "Неверный формат E-mail!").isEmail()],
  sendCodeToRestoreTheAccount
);
router.post(
  "/change",
  [
    check("email", "Неверный формат E-mail!").isEmail(),
    check("password", "Пароль не должен быть длиннее 9 и короче 20!")
      .isLength({
        min: 9,
        max: 20,
      })
      .isStrongPassword({ minLength: 0, minSymbols: 0 })
      .withMessage(
        "Пароль должен иметь как минимум одно число, одну заглавную и одну прописную букву."
      ),
    check("code", "Код не должен быть короче 1 и длиннее 8!").isLength({
      min: 1,
      max: 8,
    }),
  ],
  changePassword
);
router.delete("/delete", auth, deleteAccount);
router.get("/getinfo", auth, getUserInfo);
router.post("/token", auth, getAPIToken);
router.patch(
  "/edit",
  [
    auth,
    check("name", "Имя должно содержать от 1 до 19 символов!").isLength({
      min: 1,
      max: 19,
    }),
    check(
      "kaspi_token",
      "Токен не должен быть больше 90  и меньше 1 символов!"
    ).isLength({
      min: 1,
      max: 90,
    }),
  ],
  editAccount
);
router.patch("/notifications", auth, toggleNotifications);

export default router;
