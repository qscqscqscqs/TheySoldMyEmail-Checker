// popup.js – steuert das Popup für die TheySoldMyEmail Checker‑Erweiterung.

/**
 * Rendert die Liste der erkannten, noch nicht gelisteten Domains. Wenn keine
 * Domains vorhanden sind, wird eine entsprechende Nachricht angezeigt.
 */
function renderList() {
  browser.storage.local.get('unmatchedSites').then((result) => {
    const sites = result.unmatchedSites || [];
    const listEl = document.getElementById('unmatched-list');
    const emptyEl = document.getElementById('empty');
    listEl.innerHTML = '';
    if (sites.length === 0) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      for (const site of sites) {
        const li = document.createElement('li');
        li.textContent = site;
        listEl.appendChild(li);
      }
    }
  });
}

/**
 * Löscht die Liste der erkannten Domains und aktualisiert die Badge.
 */
function clearList() {
  browser.storage.local.set({ unmatchedSites: [] }).then(() => {
    browser.browserAction.setBadgeText({ text: '' });
    renderList();
  });
}

/**
 * Kopiert die Liste der erkannten Domains in die Zwischenablage.
 */
async function copyList() {
  try {
    const result = await browser.storage.local.get('unmatchedSites');
    const sites = result.unmatchedSites || [];

    if (sites.length === 0) {
      return;
    }

    // Domains mit Zeilenumbruch verbinden
    const text = sites.join('\n');

    // In Zwischenablage kopieren
    await navigator.clipboard.writeText(text);

    // Visuelles Feedback
    const button = document.getElementById('copy');
    const originalText = button.textContent;
    button.textContent = 'Kopiert!';
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1500);
  } catch (err) {
    console.error('Fehler beim Kopieren:', err);
    alert('Fehler beim Kopieren in die Zwischenablage');
  }
}

/**
 * Lädt die Einstellungen und setzt die Checkbox entsprechend.
 */
async function loadSettings() {
  const result = await browser.storage.local.get('fullMonitoring');
  const fullMonitoring = result.fullMonitoring || false;
  document.getElementById('fullMonitoring').checked = fullMonitoring;
}

/**
 * Speichert die Überwachungseinstellung.
 */
async function toggleMonitoring() {
  const checkbox = document.getElementById('fullMonitoring');
  await browser.storage.local.set({ fullMonitoring: checkbox.checked });
  console.log('Überwachungsmodus geändert:', checkbox.checked ? 'Vollständig' : 'Nur Navigation');
}

document.addEventListener('DOMContentLoaded', () => {
  renderList();
  loadSettings();
  document.getElementById('copy').addEventListener('click', copyList);
  document.getElementById('clear').addEventListener('click', clearList);
  document.getElementById('fullMonitoring').addEventListener('change', toggleMonitoring);
});