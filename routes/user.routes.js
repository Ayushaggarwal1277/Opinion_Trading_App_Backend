import { Router } from "express";
import { loginUser, logoutUser, refreshToken, registerUser, getCurrentUser } from "../controllers/user.controller.js";
import { getAllUserOrders } from "../controllers/trade.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(registerUser)

router.route("/login").post(loginUser)

router.route("/logout").post(verifyJWT,logoutUser)

router.route("/refresh").post(verifyJWT,refreshToken)

router.route("/me").get(verifyJWT,getCurrentUser)

router.route("/orders").get(verifyJWT,getAllUserOrders)



export default router;