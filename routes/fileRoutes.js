/**
 * fileRoutes.js
 * ------------------------------------------------------------------
 * Déclaration des routes de l'API REST :
 *   POST   /api/upload
 *   GET    /api/file/:id
 *   GET    /api/file/:id/download
 *   DELETE /api/file/:id
 *   GET    /api/health
 * ------------------------------------------------------------------
 */

const express = require('express');
const upload = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');
const controller = require('../controllers/fileController');

const router = express.Router();

router.post('/upload', uploadLimiter, upload.array('files', 10), controller.uploadFiles);
router.get('/file/:id', controller.getFileMeta);
router.get('/file/:id/download', controller.downloadFile);
router.delete('/file/:id', controller.deleteFile);
router.get('/health', controller.healthCheck);

module.exports = router;
