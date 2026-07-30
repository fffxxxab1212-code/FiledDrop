/**
 * download.js
 * ------------------------------------------------------------------
 * Logique de la page /file/:id :
 *  - Extraction de l'id depuis l'URL
 *  - Récupération des métadonnées via l'API
 *  - Affichage : nom, taille, type, expiration, aperçu (image/PDF)
 *  - Téléchargement avec barre de progression réelle (fetch + stream)
 * ------------------------------------------------------------------
 */

(() => {
  const card = document.getElementById('download-card');
  const progressWrap = document.getElementById('dl-progress-wrap');
  const progressFill = document.getElementById('dl-progress-fill');
  const progressPercent = document.getElementById('dl-progress-percent');
  const progressLabel = document.getElementById('dl-progress-label');

  const fileId = extractFileId();

  if (!fileId) {
    renderError();
  } else {
    loadMeta(fileId);
  }

  function extractFileId() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // Attendu : ['file', ':id']
    if (parts.length >= 2 && parts[0] === 'file') return parts[1];
    return null;
  }

  async function loadMeta(id) {
    try {
      const res = await fetch(`/api/file/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (res.status === 404) {
        renderExpired();
        return;
      }
      if (!res.ok) {
        renderError();
        return;
      }
      const meta = await res.json();
      renderMeta(meta);
    } catch (err) {
      renderError();
    }
  }

  function renderMeta(meta) {
    const isImage = meta.mimetype && meta.mimetype.startsWith('image/');
    const isPdf = meta.mimetype === 'application/pdf';
    const remaining = meta.expiresAt - Date.now();

    card.innerHTML = `
      <div class="file-type-badge">${getFileIcon(meta.mimetype)}</div>
      <h2>${escapeHtml(meta.name)}</h2>

      ${isImage ? `<div class="preview-box"><img src="/api/file/${meta.id}/download?t=${Date.now()}" alt="Aperçu de ${escapeHtml(meta.name)}" /></div>` : ''}
      ${isPdf ? `<div class="preview-box"><iframe src="/api/file/${meta.id}/download?t=${Date.now()}" title="Aperçu PDF"></iframe></div>` : ''}

      <div class="meta-grid">
        <div class="meta-item"><div class="label">Taille</div><div class="value">${formatBytes(meta.size)}</div></div>
        <div class="meta-item"><div class="label">Type</div><div class="value">${escapeHtml(shortMime(meta.mimetype))}</div></div>
        <div class="meta-item"><div class="label">Créé le</div><div class="value">${formatDate(meta.createdAt)}</div></div>
        <div class="meta-item expiring"><div class="label">Expire dans</div><div class="value">${formatRemaining(remaining)}</div></div>
      </div>

      <button type="button" class="btn btn-primary btn-block" id="download-btn">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Télécharger
      </button>
    `;

    document.getElementById('download-btn').addEventListener('click', () => downloadFile(meta));
  }

  function renderExpired() {
    card.innerHTML = `
      <div class="expired-state">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <h2>Ce lien n'est plus disponible</h2>
        <p>Le fichier a expiré ou a été supprimé par son propriétaire. Aucune trace n'en subsiste.</p>
      </div>
    `;
  }

  function renderError() {
    card.innerHTML = `
      <div class="error-state">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h2>Lien invalide</h2>
        <p>Ce lien ne correspond à aucun fichier partagé.</p>
      </div>
    `;
  }

  /** Télécharge le fichier via fetch + stream pour afficher une vraie progression. */
  async function downloadFile(meta) {
    const btn = document.getElementById('download-btn');
    btn.disabled = true;
    progressWrap.classList.add('visible');

    try {
      const res = await fetch(`/api/file/${meta.id}/download`, { cache: 'no-store' });
      if (!res.ok) throw new Error('download-failed');

      const total = parseInt(res.headers.get('Content-Length') || meta.size, 10);
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;

        const percent = total ? Math.round((received / total) * 100) : 0;
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressLabel.textContent = percent < 100 ? 'Téléchargement en cours…' : 'Finalisation…';
      }

      const blob = new Blob(chunks, { type: meta.mimetype });
      triggerSave(blob, meta.name);

      showToast('Téléchargement terminé.', 'success');
    } catch (err) {
      showToast('Le téléchargement a échoué.', 'error');
    } finally {
      btn.disabled = false;
      progressWrap.classList.remove('visible');
    }
  }

  /** Déclenche l'enregistrement d'un Blob côté navigateur. */
  function triggerSave(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function shortMime(mimetype) {
    if (!mimetype) return 'Inconnu';
    const parts = mimetype.split('/');
    return parts[1] ? parts[1].toUpperCase() : mimetype;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
