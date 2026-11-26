const errorMiddleware = (err, req, res, next) => {
    
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  if (res.headersSent) {
    return next(err);
  }

  // Safety net: any raw jsonwebtoken error that slips through is an auth failure (401), not a 500.
  const isJwtError = err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError";
  const statusCode = err.statusCode || (isJwtError ? 401 : 500);
  const code = err.code === "TOKEN_EXPIRED" || err?.name === "TokenExpiredError"
    ? "TOKEN_EXPIRED"
    : err.code === "TOKEN_INVALID" || isJwtError
      ? "TOKEN_INVALID"
      : undefined;
  const message = isJwtError && !err.statusCode
    ? (code === "TOKEN_EXPIRED" ? "Session expired. Please log in again." : "Invalid access token")
    : err.message || "Internal Server Error";
  const errors = err.errors || [];

  res.status(statusCode).json({
    success: false,
    message,
    ...(code && { code }),
    errors
  });
};

export default errorMiddleware;