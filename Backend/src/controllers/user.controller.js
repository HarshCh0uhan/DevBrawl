import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../model/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    const { fullName, email, username, password, phoneNumber, avatarSelection } = req.body;

    if ([fullName, email, username, password, phoneNumber].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, "All common fields are required");
    }

    const existedUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    let avatarUrl = "";
    const avatarLocalPath = req.file?.path;
    if (avatarLocalPath) {
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        if (!avatar) throw new ApiError(400, "Avatar file upload failed");
        avatarUrl = avatar.url;
    } else if (avatarSelection) {
        avatarUrl = avatarSelection;
    }

    const user = await User.create({
        fullName,
        avatar: avatarUrl,
        email,
        password,
        username: username.toLowerCase(),
        phoneNumber,
    });

    const createdUser = await User.findById(user._id).select("-password");
    if (!createdUser) throw new ApiError(500, "Something went wrong while registering the user");

    return res.status(200).json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;

    if (!email && !username) {
        throw new ApiError(400, "Email or username is required");
    }
    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const user = await User.findOne({ $or: [{ username }, { email }] });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const accessToken = user.generateAccessToken();
    const loggedInUser = await User.findById(user._id).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, { user: loggedInUser, accessToken }, "User logged in successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched"));
});

export { registerUser, loginUser, getCurrentUser };