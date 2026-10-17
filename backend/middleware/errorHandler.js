const multer = require('multer');
const { ApiError } = require('../utils/validators');
const config = require('../config/env');

/** 404 handler for unknown routes. */
function notFound(req, _res, next) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} does not exist`));
}

/** Map Mongo/Mongoose failures onto meaningful HTTP status codes. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Please correct the highlighted fields';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, value.message])
    );
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (err.code === 11000 || err.code === 11001) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    message =
      field === 'email'
        ? 'An account with that email already exists'
        : field === 'handle'
          ? 'That handle is already taken'
          : `Duplicate ${field}`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 5 MB' : `Upload failed: ${err.message}`;
  } else if (status >= 500) {
    if (config.env !== 'test') console.error('[error]', err);
    message = 'Something went wrong on our side. Please try again.';
  }

  res.status(status).json({
    success: false,
    message,
    ...(details ? { errors: details } : {}),
  });
}

module.exports = { errorHandler, notFound };