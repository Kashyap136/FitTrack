const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');
const { ApiError } = require('../utils/validators');

const uploadDir = path.isAbsolute(config.uploadsDir)
  ? config.uploadsDir
  : path.join(process.cwd(), config.uploadsDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPG, PNG, WEBP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

module.exports = { upload, uploadDir };