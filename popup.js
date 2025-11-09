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

document.addEventListener('DOMContentLoaded', () => {
  renderList();
  document.getElementById('clear').addEventListener('click', clearList);
});