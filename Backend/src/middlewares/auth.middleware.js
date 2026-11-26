import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/verifyAccessToken.js";
import { User } from "../models/user.model.js";

export const userAuth = asyncHandler(async (req, _, next) => {
    const token = req.cookies?.accessToken 
        || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = verifyAccessToken(token);

    const user = await User.findById(decodedToken?._id)
        .select("-password");

    if (!user) {
        throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
});
