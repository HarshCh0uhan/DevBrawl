import { verifyAccessToken } from "../services/token.service.js";
import { User } from "../models/user.model.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization || "").replace("Bearer ", "");

    if (!token) {
      const err = new Error("Missing token");
      err.data = { code: "TOKEN_INVALID" };
      return next(err);
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    if (!user) {
      const err = new Error("User not found");
      err.data = { code: "TOKEN_INVALID" };
      return next(err);
    }

    socket.user = user;
    return next();
  } catch (err) {
    const authError = new Error(err.message || "Authentication failed");
    authError.data = { code: err.code || "TOKEN_INVALID" };
    return next(authError);
  }
};
