/**
 * helpers.js
 * ------------------------------------------------------------------
 * Fonctions utilitaires partagées entre les pages du frontend :
 * formatage de taille/date, icône selon le type de fichier.
 * ------------------------------------------------------------------
 */

/** Formate une taille en octets en une chaîne lisible (Ko, Mo, Go). */
function formatBytes(bytes) {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Formate un timestamp ms en date/heure lisible (locale française). */
function formatDate(timestampMs) {
  const d = new Date(timestampMs);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formate une durée restante (ms) en texte court : "2 h 14", "5 j", etc. */
function formatRemaining(ms) {
  if (ms <= 0) return 'Expiré';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} j ${hours % 24} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${minutes} min`;
}

/** Icône SVG (chaîne) adaptée au type MIME, pour la liste de fichiers et la page de téléchargement. */
function getFileIcon(mimetype) {
  const type = mimetype || '';

  if (type.startsWith('image/')) {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (type === 'application/pdf') {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  }
  if (type.startsWith('video/')) {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="15" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M22 8l-5 4 5 4V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  }
  if (type.startsWith('audio/')) {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="2"/></svg>';
  }
  if (type.includes('zip') || type.includes('compressed') || type.includes('tar') || type.includes('gzip')) {
    return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 3v4m0 4v2m0 4v4M9 11h2m-2 4h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  // Générique (document / texte / autre)
  return '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
