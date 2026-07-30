/**
 * fileService.js
 * ------------------------------------------------------------------
 * Couche d'accès aux métadonnées des fichiers partagés.
 *
 * Choix technique : pas de base de données externe (pas nécessaire
 * pour ce cas d'usage, et ça simplifie le déploiement). Les métadonnées
 * sont gardées en mémoire (Map) pour la rapidité, et persistées dans un
 * fichier JSON (data/db.json) pour survivre à un redémarrage.
 *
 * Seules les informations strictement nécessaires au fonctionnement
 * sont stockées (voir "Confidentialité" du cahier des charges) :
 * aucune donnée personnelle, aucune adresse IP, aucun compte.
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config/config');

/** @type {Map<string, FileRecord>} */
const store = new Map();

// File d'attente simple pour sérialiser les écritures disque et éviter
// les écritures concurrentes qui corrompraient le fichier JSON.
let writeQueue = Promise.resolve();

/**
 * @typedef {Object} FileRecord
 * @property {string} id            Identifiant public (URL)
 * @property {string} diskName      Nom réel du fichier sur le disque
 * @property {string} originalName  Nom d'origine (affichage uniquement)
 * @property {string} mimetype
 * @property {number} size          Taille en octets
 * @property {number} createdAt     Timestamp ms
 * @property {number} expiresAt     Timestamp ms
 * @property {string} expirationKey Clé parmi config.expirationOptions
 */

/** Garantit l'existence des dossiers nécessaires au démarrage. */
async function ensureStorageReady() {
  await fsp.mkdir(config.uploadDir, { recursive: true });
  await fsp.mkdir(config.dataDir, { recursive: true });

  if (!fs.existsSync(config.dbFile)) {
    await fsp.writeFile(config.dbFile, JSON.stringify({ files: [] }, null, 2));
  }

  const raw = await fsp.readFile(config.dbFile, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { files: [] }; // fichier corrompu ou vide -> on repart propre
  }

  store.clear();
  for (const record of parsed.files || []) {
    store.set(record.id, record);
  }
}

/** Persiste l'état courant du Map vers le fichier JSON (sérialisé). */
function persist() {
  writeQueue = writeQueue.then(async () => {
    const data = { files: Array.from(store.values()) };
    const tmpFile = `${config.dbFile}.tmp`;
    // Écriture atomique : on écrit dans un fichier temporaire puis on renomme.
    await fsp.writeFile(tmpFile, JSON.stringify(data, null, 2));
    await fsp.rename(tmpFile, config.dbFile);
  });
  return writeQueue;
}

/**
 * Crée un nouvel enregistrement de fichier.
 * @param {FileRecord} record
 */
async function createFileRecord(record) {
  store.set(record.id, record);
  await persist();
  return record;
}

/**
 * Récupère un enregistrement par son id public.
 * Retourne null si absent OU expiré (l'expiration est vérifiée ici
 * pour ne jamais servir un fichier "mort" même si le cron n'est pas
 * encore passé).
 * @param {string} id
 */
function getFileRecord(id) {
  const record = store.get(id);
  if (!record) return null;
  if (Date.now() >= record.expiresAt) return null;
  return record;
}

/** Liste tous les enregistrements (utilisé par le service de nettoyage). */
function getAllRecords() {
  return Array.from(store.values());
}

/**
 * Supprime un enregistrement et son fichier associé sur le disque.
 * @param {string} id
 */
async function deleteFileRecord(id) {
  const record = store.get(id);
  if (!record) return false;

  const filePath = path.join(config.uploadDir, record.diskName);
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // on ignore si déjà supprimé
  }

  store.delete(id);
  await persist();
  return true;
}

module.exports = {
  ensureStorageReady,
  createFileRecord,
  getFileRecord,
  getAllRecords,
  deleteFileRecord,
};
