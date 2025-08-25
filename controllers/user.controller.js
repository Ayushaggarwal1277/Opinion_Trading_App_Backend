import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/users.models.js";
import cookieParser from "cookie-parser";


const generateAccessandRefreshTokens = async (userid) => {
    try {
        const user = await User.findById(userid);
        if (!user) {
            throw new Error("User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save();

        return { accessToken, refreshToken };
        
    } catch (error) {
        throw error;
    }
}



const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password,role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Please provide name, email and password"
        })
    }


    const existedUser = await User.findOne({
        $or: [{ email }]

    })

    if(existedUser)
    {
        return res.status(400).json({
            success: false,
            message: "User already exists"
        })
    }

    const user = await User.create({
        name,
        email,
        password
    });

    if(role) user.role = role;
    await user.save();

    const createdUser = await User.findById(user._id).select("-password -refreshToken -trades -refreshToken");

    if(!createdUser)
    {
        return res.status(500).json({
            success: false,
            message: "User creation failed"
        })
    }

    return res.status(201).json({createdUser});

});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email||!password) {
        return res.status(400).json({
            success: false,
            message: "Please provide email and password"
        })
    }

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(400).json({
            success: false,
            message: "User does not exist"
        })
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if(!isPasswordCorrect) 
    {
        return res.status(400).json({
            success: false,
            message: "Invalid credentials"
        })
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -trades");

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
        success: true,
        accessToken,
        refreshToken,
        user : loggedInUser
    })
});

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set: { refreshToken: "" }
        },
        { 
            new: true 
        }
    );

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({
        success: true,
        message: "User logged out successfully"
    });
});

const refreshToken = asyncHandler(async(req, res) => {
    const token = req.cookies.refreshToken;

    if(!token)
    {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id).select("-password -refreshToken -trades");

    if(!user || user.refreshToken !== token)
    {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id);

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
        success: true,
        accessToken,
        refreshToken,
        user
    })
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshToken
}