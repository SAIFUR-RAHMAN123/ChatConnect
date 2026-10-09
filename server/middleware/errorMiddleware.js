const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.expose ? err.message : 'Something went wrong';

  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Session expired, please log in again';
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value, resource already exists';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB)' : 'Invalid file upload';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : 'Invalid file upload';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message });
};

module.exports = { notFound, errorHandler };