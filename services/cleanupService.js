/**
 * cleanupService.js
 * ------------------------------------------------------------------
 * Tâche planifiée (cron) qui supprime automatiquement :
 *  - les fichiers expirés sur le disque
 *  - leurs métadonnées associées
 * Fréquence configurable via config.cleanupCron (par défaut: chaque minute).
 * ------------------------------------------------------------------
 */

const cron = require('node-cron');
const config = require('../config/config');
const fileService = require('./fileService');

let task = null;

async function runCleanupOnce() {
  const now = Date.now();
  const records = fileService.getAllRecords();
  const expired = records.filter(r => r.expiresAt <= now);

  for (const record of expired) {
    try {
      await fileService.deleteFileRecord(record.id);
      // eslint-disable-next-line no-console
      console.log(`[cleanup] Fichier expiré supprimé : ${record.id} (${record.originalName})`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[cleanup] Échec de suppression pour ${record.id} :`, err.message);
    }
  }

  return expired.length;
}

/** Démarre la tâche planifiée. */
function startCleanupJob() {
  if (task) return task;
  task = cron.schedule(config.cleanupCron, () => {
    runCleanupOnce().catch(err => console.error('[cleanup] Erreur inattendue :', err));
  });
  // eslint-disable-next-line no-console
  console.log(`[cleanup] Tâche planifiée démarrée (${config.cleanupCron})`);
  return task;
}

module.exports = { startCleanupJob, runCleanupOnce };
