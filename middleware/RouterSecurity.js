import * as dotenv from "dotenv";
dotenv.config();
const { SECRET_KEY: secretKey } = process.env;
import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
  }
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(403).json({ message: "Отказано в доступе." });
    }
    const decodedData = jwt.verify(token, secretKey);
    req.user = decodedData;
    next();
  } catch (e) {
    if (e.name === "JsonWebTokenError") {
      res.status(403).json({ message: "Отказано в доступе.", logout: "true" });
    } else {
      res.status(500).json({ message: e.name });
    }
  }
};
