const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { HttpError } = require('./httpError');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];
const PDF = [0x25, 0x50, 0x44, 0x46];
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx / xlsx / pptx / zip

// Allowlist by extension. The client-sent mime type is never trusted.
const TYPES = {
  '.png': { mime: 'image/png', image: true, sig: PNG },
  '.jpg': { mime: 'image/jpeg', image: true, sig: JPG },
  '.jpeg': { mime: 'image/jpeg', image: true, sig: JPG },
  '.gif': { mime: 'image/gif', image: true, sig: GIF },
  '.webp': { mime: 'image/webp', image: true, sig: 'webp' },
  '.pdf': { mime: 'application/pdf', sig: PDF },
  '.txt': { mime: 'text/plain', sig: 'text' },
  '.csv': { mime: 'text/csv', sig: 'text' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sig: ZIP },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sig: ZIP },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sig: ZIP },
  '.zip': { mime: 'application/zip', sig: ZIP },
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!TYPES[ext]) return cb(new HttpError(400, 'This file type is not allowed'));
    cb(null, true);
  },
});

// Checks the real file content matches its extension (stops e.g. an .exe renamed to .png).
const verifyFile = async (filePath, ext) => {
  const { sig } = TYPES[ext];
  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(512);
    const { bytesRead } = await fd.read(buf, 0, 512, 0);
    const head = buf.subarray(0, bytesRead);
    if (sig === 'webp') return head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP';
    if (sig === 'text') return !head.includes(0);
    return sig.every((b, i) => head[i] === b);
  } finally {
    await fd.close();
  }
};

// multer decodes names as latin1; restore UTF-8 and strip anything path-like
const cleanName = (name) =>
  Buffer.from(name, 'latin1')
    .toString('utf8')
    .replace(/[\\/\u0000-\u001f]/g, '_')
    .slice(0, 120) || 'file';

const removeFile = async (filename) => {
  if (!filename) return;
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(filename)));
  } catch (_) {
    /* already gone */
  }
};

module.exports = { UPLOAD_DIR, MAX_FILE_SIZE, TYPES, upload, verifyFile, cleanName, removeFile };