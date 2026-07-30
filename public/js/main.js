/**
 * main.js
 * ------------------------------------------------------------------
 * Logique de la page d'accueil :
 *  - Drag & Drop + sélection manuelle de fichiers
 *  - Affichage de la liste, taille totale, estimation du temps
 *  - Choix de la durée d'expiration
 *  - Upload via XMLHttpRequest (pour avoir la progression réelle)
 *  - Affichage du lien généré avec bouton de copie
 * ------------------------------------------------------------------
 */

(() => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const fileListEl = document.getElementById('file-list');
  const optionsPanel = document.getElementById('upload-options');
  const totalSizeEl = document.getElementById('total-size');
  const etaEl = document.getElementById('eta-estimate');
  const uploadBtn = document.getElementById('upload-btn');
  const expirationGrid = document.getElementById('expiration-grid');
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressLabel = document.getElementById('progress-label');
  const resultPanel = document.getElementById('result-panel');

  /** @type {File[]} */
  let selectedFiles = [];
  let selectedExpiration = '24h';

  // Vitesse de référence utilisée pour l'estimation AVANT le début de
  // l'upload (on n'a pas encore de mesure réelle). Volontairement
  // prudente pour ne pas promettre plus vite que la réalité.
  const ASSUMED_UPLOAD_SPEED_MBPS = 8; // Mbit/s

  // ---------------------------------------------------------------
  // Sélection de fichiers (bouton, input, drag & drop)
  // ---------------------------------------------------------------
  browseBtn.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target === browseBtn || browseBtn.contains(e.target)) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    addFiles(Array.from(fileInput.files));
    fileInput.value = ''; // permet de re-sélectionner le même fichier
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (evt === 'dragleave' && e.target !== dropzone) return;
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    addFiles(files);
  });

  /** Ajoute des fichiers à la sélection, avec garde-fous de base. */
  function addFiles(files) {
    if (files.length === 0) return;

    const merged = [...selectedFiles, ...files];
    if (merged.length > 10) {
      showToast('Maximum 10 fichiers par envoi.', 'error');
      return;
    }

    selectedFiles = merged;
    renderFileList();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
  }

  // ---------------------------------------------------------------
  // Rendu de la liste + résumé (taille totale, estimation)
  // ---------------------------------------------------------------
  function renderFileList() {
    fileListEl.innerHTML = '';

    selectedFiles.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <div class="file-row-icon">${getFileIcon(file.type)}</div>
        <div class="file-row-info">
          <div class="file-row-name">${escapeHtml(file.name)}</div>
          <div class="file-row-size">${formatBytes(file.size)}</div>
        </div>
        <button type="button" class="file-row-remove" aria-label="Retirer" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      `;
      fileListEl.appendChild(row);
    });

    fileListEl.querySelectorAll('.file-row-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFile(parseInt(btn.dataset.index, 10)));
    });

    optionsPanel.style.display = selectedFiles.length > 0 ? 'grid' : 'none';
    updateSummary();
  }

  function updateSummary() {
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    totalSizeEl.textContent = formatBytes(totalBytes);

    const totalBits = totalBytes * 8;
    const seconds = totalBits / (ASSUMED_UPLOAD_SPEED_MBPS * 1_000_000);
    etaEl.textContent = seconds < 1 ? '< 1 sec' : formatDurationShort(seconds);
  }

  function formatDurationShort(seconds) {
    if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} min`;
  }

  // ---------------------------------------------------------------
  // Sélection de la durée d'expiration
  // ---------------------------------------------------------------
  expirationGrid.addEventListener('click', (e) => {
    const chip = e.target.closest('.expiration-chip');
    if (!chip) return;
    expirationGrid.querySelectorAll('.expiration-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedExpiration = chip.dataset.key;
  });

  // ---------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------
  uploadBtn.addEventListener('click', () => {
    if (selectedFiles.length === 0) return;
    uploadFiles();
  });

  function uploadFiles() {
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
    formData.append('expiration', selectedExpiration);

    uploadBtn.disabled = true;
    progressWrap.classList.add('visible');
    resultPanel.classList.remove('visible');
    resultPanel.innerHTML = '';

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();

    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const percent = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;

      // Estimation dynamique basée sur la vitesse réelle mesurée
      const elapsedSec = (Date.now() - startTime) / 1000;
      if (elapsedSec > 0.5 && e.loaded > 0) {
        const speedBps = e.loaded / elapsedSec;
        const remainingBytes = e.total - e.loaded;
        const remainingSec = remainingBytes / speedBps;
        progressLabel.textContent = percent < 100
          ? `Envoi en cours… (${formatDurationShort(remainingSec)} restantes)`
          : 'Finalisation…';
      }
    });

    xhr.addEventListener('load', () => {
      uploadBtn.disabled = false;
      let response;
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        response = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && response) {
        showToast('Envoi terminé avec succès.', 'success');
        renderResults(response.files);
        resetSelection();
      } else {
        const message = (response && response.error) || "Échec de l'envoi.";
        showToast(message, 'error');
      }
      progressWrap.classList.remove('visible');
    });

    xhr.addEventListener('error', () => {
      uploadBtn.disabled = false;
      progressWrap.classList.remove('visible');
      showToast('Erreur réseau pendant l\'envoi.', 'error');
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  function resetSelection() {
    selectedFiles = [];
    renderFileList();
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
  }

  /** Affiche les liens générés pour chaque fichier envoyé. */
  function renderResults(files) {
    resultPanel.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'result-item';
      item.innerHTML = `
        <div class="result-item-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="result-link-row">
          <input type="text" class="result-link-input" value="${escapeHtml(file.url)}" readonly />
          <button type="button" class="copy-btn" title="Copier le lien" data-url="${escapeHtml(file.url)}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" stroke-width="2"/></svg>
          </button>
        </div>
      `;
      resultPanel.appendChild(item);
    });

    resultPanel.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.url));
    });

    resultPanel.classList.add('visible');
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Lien copié dans le presse-papiers.', 'success', 2500))
      .catch(() => showToast('Impossible de copier le lien.', 'error'));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
