import { Router } from "express";
import { getCurrentWeather } from "../controllers/weather.controller.js";

const weatherRouter = Router();

// Public route to get current weather
weatherRouter.route("/current").get(getCurrentWeather);

export default weatherRouter;
