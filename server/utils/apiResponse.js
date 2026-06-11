const sendSuccess = (res, message, data = {}, statusCode = 200, extra = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra
  });
};

const sendError = (res, message, statusCode = 500, error = null) => {
  const response = {
    success: false,
    message
  };
  if (error && process.env.NODE_ENV !== 'production') {
    response.error = error.message || error;
  }
  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};
