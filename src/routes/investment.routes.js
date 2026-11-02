import express from "express";
import { investmentController } from "../controllers/investment.controller.js";

const router = express.Router();

router.post("/sip", investmentController.calculateSIP);

export default router;
