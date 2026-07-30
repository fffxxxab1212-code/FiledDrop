/**
 * originCheck.js
 * ------------------------------------------------------------------
 * Protection CSRF adaptée au contexte de l'application.
 *
 * Le CSRF classique (token synchronizer / double-submit cookie) protège
 * des requêtes qui s'appuient sur une authentification par cookie/session.
 * Ici, conformément au cahier des charges ("aucun compte obligatoire,
 * pas de cookies inutiles"), l'API n'utilise ni cookie ni session : il
 * n'y a donc pas d'"ambient credential" qu'un site tiers pourrait
 * réutiliser à l'insu de l'utilisateur, ce qui élimine la surface
 * d'attaque CSRF classique.
 *
 * Pour autant, on applique une défense en profondeur pragmatique sur
 * toutes les requêtes qui modifient l'état (POST/DELETE) : on vérifie
 * que l'en-tête Origin (ou à défaut Referer) correspond bien à une
 * origine autorisée. Cela bloque les requêtes déclenchées depuis des
 * pages web arbitraires.
 *
 * Si le projet évolue vers une authentification par cookie (voir
 * "Fonctionnalités futures : compte utilisateur"), il faudra alors
 * ajouter un vrai mécanisme de token CSRF ici.
 * ------------------------------------------------------------------
 */

const config = require('../config/config');

function extractOrigin(req) {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function originCheck(req, res, next) {
  // Seules les méthodes qui modifient l'état sont concernées.
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Si PUBLIC_URL est celui par défaut (non configuré), on ne bloque pas
  // les requêtes, car le frontend et l'API sont servis depuis le même domaine.
  const isDefaultUrl = config.publicUrl === 'http://localhost:3000';
  const allowedOrigins = [config.publicUrl, ...config.corsOrigins].filter(Boolean);

  // En développement, si aucune origine n'est configurée explicitement,
  // ou si PUBLIC_URL est la valeur par défaut (non configurée),
  // on n'impose pas la vérification.
  if (allowedOrigins.length === 0 || isDefaultUrl) return next();

  const requestOrigin = extractOrigin(req);

  // Pas d'en-tête Origin/Referer : requête faite hors navigateur
  // (curl, script serveur à serveur) -> on laisse passer, la protection
  // CSRF vise spécifiquement les navigateurs.
  if (!requestOrigin) return next();

  const isAllowed = allowedOrigins.some(allowed => requestOrigin === allowed);
  if (!isAllowed) {
    // eslint-disable-next-line no-console
    console.warn(`[originCheck] Requête bloquée : origin="${requestOrigin}", allowed="${allowedOrigins.join(', ')}"`);
    return res.status(403).json({ error: 'Origine de la requête non autorisée.' });
  }

  return next();
}

module.exports = originCheck;
