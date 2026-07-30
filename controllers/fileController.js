/**
 * fileController.js
 * ------------------------------------------------------------------
 * Logique métier de l'API : upload, récupération des métadonnées,
 * téléchargement du fichier binaire, suppression manuelle.
 * ------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const fileService = require('../services/fileService');
const { generatePublicId } = require('../utils/idGenerator');
const {
  isValidExpirationKey,
  isValidPublicId,
  sanitizeDisplayName,
} = require('../utils/validators');

/**
 * Interdit toute mise en cache par le navigateur (ou un proxy intermédiaire).
 *
 * Sans ces en-têtes, un navigateur peut resservir une réponse mémorisée
 * (notamment le fichier chargé via une balise <img> pour l'aperçu, ou la
 * réponse JSON des métadonnées) après l'expiration réelle du lien côté
 * serveur — l'utilisateur verrait alors encore le fichier alors qu'il
 * n'existe déjà plus en base. On force donc une revalidation systématique.
 */
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * POST /api/upload
 * Reçoit un ou plusieurs fichiers (déjà traités par Multer) et crée
 * une métadonnée + un lien public pour chacun.
 */
async function uploadFiles(req, res, next) {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }

    const expirationKey = isValidExpirationKey(req.body.expiration)
      ? req.body.expiration
      : config.defaultExpiration;

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > config.maxTotalSizeMb * 1024 * 1024) {
      // Nettoyage des fichiers déjà écrits sur le disque avant de refuser
      await Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
      return res.status(400).json({
        error: `Taille totale trop importante (max ${config.maxTotalSizeMb} Mo).`,
      });
    }

    const now = Date.now();
    const expiresAt = now + config.expirationOptions[expirationKey].ms;

    const results = [];
    for (const file of files) {
      const record = {
        id: generatePublicId(),
        diskName: file.filename,
        originalName: sanitizeDisplayName(file.originalname),
        mimetype: file.mimetype,
        size: file.size,
        createdAt: now,
        expiresAt,
        expirationKey,
      };
      // eslint-disable-next-line no-await-in-loop
      await fileService.createFileRecord(record);
      results.push(toPublicMeta(record));
    }

    res.status(201).json({ files: results });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/file/:id
 * Retourne les métadonnées publiques d'un fichier (sans le contenu).
 */
function getFileMeta(req, res) {
  noStore(res);
  const { id } = req.params;
  if (!isValidPublicId(id)) {
    return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  }

  const record = fileService.getFileRecord(id);
  if (!record) {
    return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  }

  res.json(toPublicMeta(record));
}

/**
 * GET /api/file/:id/download
 * Envoie le contenu binaire du fichier au client.
 */
function downloadFile(req, res) {
  noStore(res);
  const { id } = req.params;
  if (!isValidPublicId(id)) {
    return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  }

  const record = fileService.getFileRecord(id);
  if (!record) {
    return res.status(404).json({ error: 'Lien invalide ou expiré.' });
  }

  const filePath = path.join(config.uploadDir, record.diskName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier introuvable.' });
  }

  res.setHeader('Content-Type', record.mimetype || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(record.originalName)}"`
  );
  res.setHeader('Content-Length', record.size);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  fs.createReadStream(filePath).pipe(res);
}

/**
 * DELETE /api/file/:id
 * Suppression manuelle et anticipée d'un fichier par son propriétaire.
 */
async function deleteFile(req, res, next) {
  try {
    const { id } = req.params;
    if (!isValidPublicId(id)) {
      return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    }

    const deleted = await fileService.deleteFileRecord(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Fichier introuvable.' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

/** GET /api/health */
function healthCheck(req, res) {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
}

/** Ne jamais exposer diskName ou le chemin disque au client. */
function toPublicMeta(record) {
  return {
    id: record.id,
    url: `${config.publicUrl}/file/${record.id}`,
    name: record.originalName,
    mimetype: record.mimetype,
    size: record.size,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    expirationKey: record.expirationKey,
  };
}

module.exports = {
  uploadFiles,
  getFileMeta,
  downloadFile,
  deleteFile,
  healthCheck,
};
