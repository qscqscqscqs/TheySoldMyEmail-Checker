/*
 * Hintergrundskript für die TheySoldMyEmail Checker‑Erweiterung.
 *
 * Dieses Skript lädt regelmäßig die Domain-Liste von der optimierten URL.
 * Bei jedem Seitenaufruf wird die aktuell besuchte Domain gegen diese Liste geprüft.
 * Wenn eine Domain nicht enthalten ist, wird sie in einer Sammlung für potentielle
 * neue Einträge gespeichert und die Anzahl offener Vorschläge als Badge angezeigt.
 */

const LIST_URL = 'http://addons.qscqscqscqs.de/issue_urls.txt';
// Intervall für die Aktualisierung der Liste (in Millisekunden). Sechs Stunden.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Set für Domains aus der Liste (normalisiert)
let knownDomains = new Set();
// Set für nicht gelistete Domains. Wird im lokalen Speicher persistiert.
let unmatchedSites = new Set();

/**
 * Normalisiert eine Domain für den Vergleich:
 * - In Kleinbuchstaben umwandeln
 * - www. Präfix entfernen
 * - Protokoll und Pfad entfernen (falls vorhanden)
 * 
 * @param {string} domain Die zu normalisierende Domain/URL
 * @returns {string} Die normalisierte Domain
 */
function normalizeDomain(domain) {
  let normalized = domain.toLowerCase().trim();
  
  // URL parsen falls vollständige URL übergeben wurde
  try {
    // Füge http:// hinzu falls kein Protokoll vorhanden
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'http://' + normalized;
    }
    const url = new URL(normalized);
    normalized = url.hostname;
  } catch (e) {
    // Falls URL-Parsing fehlschlägt, verwende den String direkt als Hostname
    console.debug('URL-Parsing fehlgeschlagen, verwende String direkt:', domain);
  }
  
  // www. Präfix entfernen
  if (normalized.startsWith('www.')) {
    normalized = normalized.slice(4);
  }
  
  return normalized;
}

/**
 * Lädt die Domain-Liste von der optimierten URL
 */
async function fetchDomainList() {
  try {
    const response = await fetch(LIST_URL);
    if (!response.ok) {
      throw new Error(`Fehler beim Laden der Domain-Liste: ${response.status}`);
    }
    const text = await response.text();
    const lines = text.split('\n');
    const domains = new Set();
    
    for (const line of lines) {
      const domain = line.trim();
      if (domain && !domain.startsWith('#')) { // Leerzeilen und Kommentare ignorieren
        const normalized = normalizeDomain(domain);
        if (normalized) {
          domains.add(normalized);
        }
      }
    }
    
    knownDomains = domains;
    console.debug(`Geladene Domains (${knownDomains.size}):`, Array.from(knownDomains).slice(0, 10));
  } catch (err) {
    console.error('Fehler beim Abrufen der Domain-Liste:', err);
  }
}

/**
 * Prüft, ob die übergebene Domain in der geladenen Liste vorhanden ist.
 * 
 * @param {string} host Die besuchte Domain
 * @returns {boolean} True, wenn die Domain in der Liste enthalten ist
 */
function isListed(host) {
  const normalizedHost = normalizeDomain(host);
  
  // Direkter Vergleich
  if (knownDomains.has(normalizedHost)) {
    return true;
  }
  
  // Prüfe auf Subdomain-Varianten
  for (const knownDomain of knownDomains) {
    // Wenn die bekannte Domain eine Subdomain der besuchten Domain ist
    if (normalizedHost.endsWith('.' + knownDomain)) {
      return true;
    }
    // Wenn die besuchte Domain eine Subdomain der bekannten Domain ist
    if (knownDomain.endsWith('.' + normalizedHost)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Aktualisiert die Badge‑Anzeige am Erweiterungsicon.
 */
function updateBadge() {
  const count = unmatchedSites.size;
  const text = count > 0 ? String(count) : '';
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color: '#E57373' });
}

/**
 * Verarbeitet eine besuchte URL und prüft, ob die Domain gelistet ist
 */
function processUrl(urlString) {
  try {
    const url = new URL(urlString);
    const host = url.hostname;
    
    // Bei file://, about:, data: etc. keine Prüfung
    if (!host || host === '' || url.protocol === 'file:' || url.protocol === 'about:' || url.protocol === 'data:') {
      return;
    }
    
    if (!isListed(host)) {
      // Domain als nicht gelistet merken
      if (!unmatchedSites.has(host)) {
        unmatchedSites.add(host);
        // Persistieren
        browser.storage.local.set({ unmatchedSites: Array.from(unmatchedSites) });
        updateBadge();
        console.debug(`Neue ungelistete Domain erkannt: ${host}`);
      }
    }
  } catch (e) {
    // Fehlerhafte URLs ignorieren
    console.warn('Konnte URL nicht verarbeiten:', urlString, e);
  }
}

/**
 * Initialisiert die Erweiterung
 */
async function init() {
  // Geladene unlisted Sites aus dem lokalen Speicher übernehmen
  const result = await browser.storage.local.get('unmatchedSites');
  const stored = result.unmatchedSites || [];
  unmatchedSites = new Set(stored);
  updateBadge();
  
  // Liste laden
  await fetchDomainList();
  
  // Eventlistener für jede neue Navigation (nur Hauptframe)
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) {
      return;
    }
    processUrl(details.url);
  });
  
  // Auch Tabs, die bereits beim Start geöffnet sind, prüfen
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.url) {
      processUrl(tab.url);
    }
  }
  
  // Eventlistener für Tab-Aktualisierungen
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      processUrl(changeInfo.url);
    }
  });
  
  // Regelmäßige Aktualisierung der Liste
  setInterval(fetchDomainList, REFRESH_INTERVAL_MS);
}

// Startpunkt
init();