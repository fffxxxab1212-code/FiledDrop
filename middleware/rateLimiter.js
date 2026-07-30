/**
 * rateLimiter.js
 * ------------------------------------------------------------------
 * Limitation du nombre de requêtes par IP pour se protéger contre les
 * abus (spam d'upload, brute-force sur /file/:id, DoS applicatif).
 * ------------------------------------------------------------------
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/config');

/** Limiteur général appliqué à toute l'API. */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Merci de réessayer plus tard.' },
});

/** Limiteur strict spécifique à l'upload (plus coûteux en ressources). */
const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxUploads,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop d'uploads depuis cette adresse. Merci de réessayer plus tard." },
});

module.exports = { generalLimiter, uploadLimiter };
