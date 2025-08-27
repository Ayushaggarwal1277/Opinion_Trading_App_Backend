import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/users.models.js";
import jwt from "jsonwebtoken";

// Generate access and refresh tokens
const generateAccessandRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new Error("Something went wrong while generating refresh and access token");
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Please provide name, email and password"
        })
    }

    const existedUser = await User.findOne({
        $or: [{ email }]
    })

    if(existedUser) {
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

    if(role) {
        user.role = role;
        await user.save();
    }

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser) {
        return res.status(500).json({
            success: false,
            message: "User creation failed"
        })
    }

    // Generate tokens and auto-login the user
    const { accessToken, refreshToken } = await generateAccessandRefreshTokens(createdUser._id);

    const options = {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'lax'
    }

    return res.status(201)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json({
            success: true,
            message: "User registered successfully",
            data: {
                user: createdUser,
                accessToken,
                refreshToken
            }
        });
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
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'lax', // Allow cross-origin requests from frontend
        maxAge: 15 * 60 * 1000 // 15 minutes for access token
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
        success: true,
        message: "User logged in successfully",
        data: {
            user: loggedInUser,
            accessToken,
            refreshToken
        }
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
    )

    const options = {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({
        success: true,
        message: "User logged Out"
    })
});

const refreshToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized request"
        })
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            })
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is expired or used"
            })
        }

        const options = {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'lax', // Allow cross-origin requests from frontend
            maxAge: 24 * 60 * 60 * 1000 // 24 hours for refresh token
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessandRefreshTokens(user._id);

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken,
            message: "Access token refreshed"
        })

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error?.message || "Invalid refresh token"
        })
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user; // From auth middleware
    
    return res.status(200).json({
        success: true,
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                balance: user.balance,
                role: user.role
            }
        }
    });
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshToken,
    getCurrentUser
};
