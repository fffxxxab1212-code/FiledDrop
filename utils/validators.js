/**
 * validators.js
 * ------------------------------------------------------------------
 * Petites fonctions de validation pures, réutilisées par les
 * middlewares et les contrôleurs. Aucune dépendance externe :
 * on garde le contrôle total sur les règles de sécurité.
 * ------------------------------------------------------------------
 */

const path = require('path');
const config = require('../config/config');

/**
 * Vérifie que la clé d'expiration envoyée par le client est bien
 * une des valeurs autorisées côté serveur (jamais confiance au client).
 */
function isValidExpirationKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(config.expirationOptions, key);
}

/**
 * Vérifie qu'un identifiant public respecte le format attendu
 * (alphanumérique, longueur fixe) avant toute recherche en base.
 * Évite d'exposer des comportements différents pour des entrées invalides.
 */
function isValidPublicId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9]{10,32}$/.test(id);
}

/**
 * Double vérification du type de fichier : MIME déclaré + extension.
 * Le MIME envoyé par le navigateur n'est qu'une déclaration ; on
 * s'assure aussi que l'extension n'est pas dans la liste noire.
 */
function isAllowedFile(originalName, mimetype) {
  const ext = path.extname(originalName || '').toLowerCase();

  if (config.blockedExtensions.includes(ext)) {
    return { ok: false, reason: `Extension non autorisée : ${ext}` };
  }

  if (!config.allowedMimeTypes.includes(mimetype)) {
    return { ok: false, reason: `Type de fichier non autorisé : ${mimetype}` };
  }

  return { ok: true };
}

/**
 * Nettoie un nom de fichier pour un affichage sûr (métadonnées uniquement,
 * jamais utilisé pour le chemin disque réel). Retire les caractères de
 * contrôle et limite la longueur.
 */
function sanitizeDisplayName(name) {
  if (typeof name !== 'string') return 'fichier';
  return name
    .replace(/[\u0000-\u001f\u007f]/g, '') // caractères de contrôle
    .replace(/[/\\]/g, '_') // pas de séparateurs de chemin
    .slice(0, 255)
    .trim() || 'fichier';
}

module.exports = {
  isValidExpirationKey,
  isValidPublicId,
  isAllowedFile,
  sanitizeDisplayName,
};
