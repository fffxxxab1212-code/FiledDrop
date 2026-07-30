/**
 * idGenerator.js
 * ------------------------------------------------------------------
 * Génération d'identifiants cryptographiquement sûrs.
 * - generatePublicId() : identifiant exposé dans l'URL (/file/:id).
 *   Utilise crypto.randomBytes -> impossible à deviner ou à énumérer.
 * - generateDiskName() : nom de fichier réel sur le disque, totalement
 *   déconnecté du nom original pour éviter toute fuite d'information
 *   et tout risque de path traversal.
 * ------------------------------------------------------------------
 */

const crypto = require('crypto');
const path = require('path');
const config = require('../config/config');

// Alphabet base62 (pas de caractères ambigus, URL-safe sans encodage)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Convertit des octets aléatoires en chaîne base62.
 * @param {number} byteLength
 * @returns {string}
 */
function randomBase62(byteLength) {
  const bytes = crypto.randomBytes(byteLength);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return result;
}

/**
 * Génère l'identifiant public utilisé dans le lien de partage.
 * Ex: https://monsite.local/file/aZ9kLmQ2xT8pR4vN
 */
function generatePublicId() {
  return randomBase62(config.publicIdBytes);
}

/**
 * Génère un nom de fichier aléatoire pour le stockage disque,
 * en conservant uniquement l'extension d'origine (utile pour les
 * previews navigateur), jamais le nom original.
 * @param {string} originalName
 */
function generateDiskName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase().slice(0, 10); // extension bornée
  const uuid = crypto.randomUUID();
  // On whitelist les caractères de l'extension pour éviter toute injection de chemin
  const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : '';
  return `${uuid}${safeExt}`;
}

module.exports = { generatePublicId, generateDiskName };
