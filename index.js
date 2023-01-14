import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import AuthRoutes from "./routes/AuthRoutes.js";
import OrderRoutes from "./routes/OrderRoutes.js";

const PORT = process.env.PORT ? process.env.PORT : 109;
const app = express();
app.use(cors());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
app.use("/api/auth/", AuthRoutes);
app.use("/api/orders/", OrderRoutes);
app.listen(PORT, () => {
  console.log(`Server is LIVE. Go to http://[your-ip]:${PORT} to verify.`);
});
