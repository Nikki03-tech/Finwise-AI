import express from "express";
import { marketController } from "../controllers/market.controller.js";

const router = express.Router();

router.get("/search", marketController.search);
router.get("/quote", marketController.quote);
router.get("/history", marketController.history);
router.get("/news", marketController.news);

export default router;
