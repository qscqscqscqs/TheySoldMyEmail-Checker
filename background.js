/*
 * Hintergrundskript für die TheySoldMyEmail Checker‑Erweiterung.
 *
 * Dieses Skript lädt regelmäßig die Übersichtsliste der Seiten aus dem
 * GitHub‑Issue #98 des Projekts TheySoldMyEmail. Bei jedem Seitenaufruf
 * wird die aktuell besuchte Domain gegen diese Liste geprüft. Wenn eine
 * Domain nicht enthalten ist, wird sie in einer Sammlung für potentielle
 * neue Einträge gespeichert und die Anzahl offener Vorschläge als Badge
 * angezeigt. Die gesammelten Domains können über das Popup eingesehen
 * werden.
 */

const ISSUE_ENDPOINT =
  'https://api.github.com/repos/svemailproject/TheySoldMyEmail/issues/98';
// Intervall für die Aktualisierung der Liste (in Millisekunden). Sechs Stunden.
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Liste der bekannten Seitennamen aus dem Issue. Kleinbuchstaben und ohne
// Sonderzeichen speichern, um Vergleiche zu vereinfachen.
let siteList = [];
// Set für nicht gelistete Domains. Wird im lokalen Speicher persistiert.
let unmatchedSites = new Set();

/**
 * Entfernt alle nicht alphanumerischen Zeichen aus einem String und
 * wandelt ihn in Kleinbuchstaben um. Damit wird sowohl die Liste als
 * auch der zu prüfende Hostname normalisiert.
 *
 * @param {string} str Der Eingabestring
 * @returns {string} Der bereinigte String
 */
/**
 * Normalisiert einen String für Vergleiche. Neben der Umwandlung in
 * Kleinbuchstaben und dem Entfernen aller nicht alphanumerischen Zeichen
 * werden auch Akzent‑ und Sonderzeichen beseitigt. So wird etwa „ö“ zu
 * „o“ und „ß“ zu „ss“. Dadurch lassen sich Begriffe mit abweichender
 * Schreibweise (z. B. Leerzeichen oder Umlaute) besser abgleichen.
 *
 * @param {string} str Der Eingabestring
 * @returns {string} Der bereinigte String
 */
function normalize(str) {
  return str
    .toLowerCase()
    // deutsche Sonderzeichen vor der Unicode‑Normalisierung ersetzen,
    // damit sie nicht bereits in ihre Einzelbestandteile zerlegt werden
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Unicode‑Normalisierung: zerlegt Zeichen in Basisbuchstaben + Diakritika
    .normalize('NFD')
    // entfernt alle Kombinationszeichen (Diakritika)
    .replace(/[\u0300-\u036f]/g, '')
    // entfernt alle übrigen nicht alphanumerischen Zeichen
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Entfernt häufige Präfixe (z. B. "www") sowie bekannte Top‑Level‑Domains
 * aus einem bereits normalisierten String. Damit wird der Kern der
 * Domain extrahiert (z. B. aus "wwwservustvcom" wird "servustv"). Dies
 * erleichtert den Abgleich zwischen verschiedenen Schreibweisen von
 * Webseitenname und Host.
 *
 * @param {string} norm Normalisierter Domänenname ohne Sonderzeichen
 * @returns {string} Der gekürzte String
 */
function stripWwwAndTld(norm) {
  let s = norm;
  // www‑Präfix am Anfang entfernen
  if (s.startsWith('www')) {
    s = s.slice(3);
  }
  // Liste gängiger Top‑Level‑Domains zum Abgleich
  const tlds = [
    'com', 'net', 'org', 'de', 'tv', 'at', 'ch', 'info', 'io', 'app',
    'co', 'uk', 'us', 'me', 'ai', 'biz', 'xyz', 'site', 'online',
    'store', 'pro', 'club', 'dev', 'edu'
  ];
  for (const tld of tlds) {
    if (s.endsWith(tld) && s.length > tld.length) {
      return s.slice(0, -tld.length);
    }
  }
  return s;
}

/**
 * Lädt die Liste der Seiten aus dem GitHub‑Issue. Die API liefert den
 * Text des Issues mit Tabulator getrennten Spalten. In der ersten Spalte
 * steht der Webseitenname. Dieser wird normalisiert und in die
 * globale Variable siteList geschrieben.
 */
async function fetchSiteList() {
  try {
    const response = await fetch(ISSUE_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Fehler beim Laden der Issue‑Daten: ${response.status}`);
    }
    const data = await response.json();
    const body = data.body || '';
    const lines = body.split('\n');
    const sites = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length > 0) {
        const name = parts[0].trim();
        if (name && name !== 'Webseite / Dienst') {
          const normalized = normalize(name);
          if (normalized.length > 0) {
            sites.push(normalized);
          }
        }
      }
    }
    siteList = sites;
    // Optional: Debugausgabe
    console.debug(`Geladene Sites (${siteList.length}):`, siteList);
  } catch (err) {
    console.error('Fehler beim Abrufen der Seite:', err);
  }
}

/**
 * Prüft, ob die übergebene Domain in der geladenen Liste vorhanden ist.
 * Die Domain wird normalisiert; anschließend wird gegen jedes Element der
 * siteList geprüft, ob entweder die Domain das Seitenschlagwort
 * enthält oder umgekehrt. Eine exakte Übereinstimmung ist nicht nötig,
 * damit auch Subdomains erkannt werden. Diese Heuristik kann false
 * positives erzeugen, liefert aber in der Praxis brauchbare Ergebnisse.
 *
 * @param {string} host Die besuchte Domain
 * @returns {boolean} True, wenn die Domain in der Liste enthalten ist
 */
function isListed(host) {
  // Normalisierte Darstellung der besuchten Domain
  const normalizedHost = normalize(host);
  // Zusätzlich Kern der Domain extrahieren (ohne www/TLD)
  const strippedHost = stripWwwAndTld(normalizedHost);
  // Prüfe gegen jede geladene Seite
  for (const site of siteList) {
    // Direkter Vergleich der normalisierten Zeichenketten
    if (normalizedHost.includes(site) || site.includes(normalizedHost)) {
      return true;
    }
    // Vergleich ohne Präfix/TLD
    const strippedSite = stripWwwAndTld(site);
    if (
      strippedHost.includes(site) ||
      strippedHost.includes(strippedSite) ||
      site.includes(strippedHost) ||
      strippedSite.includes(strippedHost)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Aktualisiert die Badge‑Anzeige am Erweiterungsicon. Die Anzahl der
 * noch nicht gelisteten Domains wird als Text gesetzt. Wenn keine
 * ungelisteten Domains vorhanden sind, wird der Badge deaktiviert.
 */
function updateBadge() {
  const count = unmatchedSites.size;
  const text = count > 0 ? String(count) : '';
  browser.browserAction.setBadgeText({ text });
  browser.browserAction.setBadgeBackgroundColor({ color: '#E57373' });
}

/**
 * Initialisiert die Erweiterung: lädt Persistente Daten, holt die
 * aktuelle Seitenliste vom GitHub‑API und setzt Eventlistener für
 * Webnavigation. Nach dem Laden werden periodisch neue Daten geladen.
 */
async function init() {
  // Geladene unlisted Sites aus dem lokalen Speicher übernehmen
  const result = await browser.storage.local.get('unmatchedSites');
  const stored = result.unmatchedSites || [];
  unmatchedSites = new Set(stored);
  updateBadge();
  // Liste laden
  await fetchSiteList();
  // Eventlistener für jede neue Navigation (nur Hauptframe)
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) {
      return;
    }
    try {
      const url = new URL(details.url);
      const host = url.hostname;
      // Bei file:// oder about: pages keine Prüfung
      if (!host || host === '') return;
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
      console.warn('Konnte URL nicht verarbeiten:', details.url, e);
    }
  });
  // Regelmäßige Aktualisierung der Liste
  setInterval(fetchSiteList, REFRESH_INTERVAL_MS);
}

// Startpunkt
init();