const errorMiddleware = (err, req, res, next) => {
    
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const errors = err.errors || [];

  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

export default errorMiddleware;