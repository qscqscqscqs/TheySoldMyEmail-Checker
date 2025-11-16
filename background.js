/*
 * Hintergrundskript für die TheySoldMyEmail Checker‑Erweiterung.
 *
 * Dieses Skript lädt regelmäßig die Domain-Liste direkt von der GitHub API.
 * Bei jedem Seitenaufruf wird die aktuell besuchte Domain gegen diese Liste geprüft.
 * Wenn eine Domain nicht enthalten ist, wird sie in einer Sammlung für potentielle
 * neue Einträge gespeichert und die Anzahl offener Vorschläge als Badge angezeigt.
 */

// GitHub Repository für TheySoldMyEmail
const GITHUB_REPO = 'svemailproject/TheySoldMyEmail';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
// Intervall für die Prüfung auf neue Issues (in Millisekunden). Fünfzehn Minuten.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
// Minimale Zeit zwischen vollständigen Reloads (24 Stunden)
const FULL_RELOAD_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Rate Limit Handling
let rateLimitHit = false;
let rateLimitResetTime = 0;

// Set für Domains aus der Liste (normalisiert)
let knownDomains = new Set();
// Set für nicht gelistete Domains. Wird im lokalen Speicher persistiert.
let unmatchedSites = new Set();
// Überwachungsmodus: false = nur Navigation, true = alle Tab-Updates
let fullMonitoring = false;

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
 * Prüft, ob ein Text eine vollständige URL ist
 */
function isFullUrl(text) {
  const s = (text || '').trim();
  if (!s.startsWith('http://') && !s.startsWith('https://')) {
    return false;
  }
  try {
    const url = new URL(s);
    return url.protocol && url.hostname;
  } catch {
    return false;
  }
}

/**
 * Extrahiert die Domain aus einer URL
 */
function hostFromUrl(url) {
  try {
    const parsed = new URL(url);
    return canonicalizeHost(parsed.hostname || '');
  } catch {
    return '';
  }
}

/**
 * Kanonisiert einen Hostnamen (lowercase, www. entfernen)
 */
function canonicalizeHost(host) {
  if (!host) return '';
  let h = host.trim().toLowerCase();
  // Userinfo und Port entfernen falls vorhanden
  if (h.includes('@')) {
    h = h.split('@').pop();
  }
  if (h.includes(':')) {
    h = h.split(':')[0];
  }
  // www. Präfix entfernen
  if (h.startsWith('www.')) {
    h = h.slice(4);
  }
  return h.includes('.') ? h : '';
}

/**
 * Extrahiert die erste Domain aus einem Text (unterstützt URLs und bare domains)
 */
function extractFirstHost(text) {
  if (!text) return '';

  // Regex für vollständige URLs
  const urlRegex = /https?:\/\/[^\s<>()\[\]"']+/i;
  // Regex für bare domains (ohne @ davor, um E-Mails auszuschließen)
  const bareDomainRegex = /(?<!@)\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}))\b(?:\/[\w\-./?%#=&+]*)?/i;

  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;

    const urlMatch = urlRegex.exec(line);
    const domainMatch = bareDomainRegex.exec(line);

    if (!urlMatch && !domainMatch) continue;

    if (urlMatch && domainMatch) {
      // Nimm das, was zuerst kommt
      if (urlMatch.index <= domainMatch.index) {
        const url = urlMatch[0].replace(/[.,;:!?)}"'`]+$/, '');
        return hostFromUrl(url);
      } else {
        const domain = domainMatch[1].replace(/[.,;:!?)}"'`]+$/, '');
        return canonicalizeHost(domain);
      }
    } else if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:!?)}"'`]+$/, '');
      return hostFromUrl(url);
    } else {
      const domain = domainMatch[1].replace(/[.,;:!?)}"'`]+$/, '');
      return canonicalizeHost(domain);
    }
  }
  return '';
}

/**
 * Extrahiert ALLE Domains aus einem Text (unterstützt URLs und bare domains)
 */
function extractAllHosts(text) {
  if (!text) return [];

  const hosts = [];

  // Regex für vollständige URLs (global flag)
  const urlRegex = /https?:\/\/[^\s<>()\[\]"']+/gi;
  // Regex für bare domains (ohne @ davor, um E-Mails auszuschließen, global flag)
  const bareDomainRegex = /(?<!@)\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}))\b(?:\/[\w\-./?%#=&+]*)?/gi;

  // Alle URLs extrahieren
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?)}"'`]+$/, '');
    const host = hostFromUrl(url);
    if (host && !hosts.includes(host)) {
      hosts.push(host);
    }
  }

  // Alle bare domains extrahieren
  while ((match = bareDomainRegex.exec(text)) !== null) {
    const domain = match[1].replace(/[.,;:!?)}"'`]+$/, '');
    const host = canonicalizeHost(domain);
    if (host && !hosts.includes(host)) {
      hosts.push(host);
    }
  }

  return hosts;
}

/**
 * Behandelt Rate-Limit-Antworten und speichert Reset-Zeit
 */
function handleRateLimit(response) {
  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    
    // Nur als Rate-Limit behandeln wenn wirklich keine Requests mehr übrig sind
    if (rateLimitRemaining === '0' || rateLimitRemaining === null) {
      rateLimitHit = true;
      const resetHeader = response.headers.get('X-RateLimit-Reset');
      if (resetHeader) {
        rateLimitResetTime = parseInt(resetHeader, 10) * 1000; // Unix timestamp in ms
        const resetDate = new Date(rateLimitResetTime);
        console.warn(`GitHub API Rate Limit erreicht. Reset um: ${resetDate.toLocaleTimeString()}`);
        
        // Rate-Limit-Status speichern
        browser.storage.local.set({ 
          rateLimitHit: true, 
          rateLimitResetTime: rateLimitResetTime 
        }).catch(err => console.error('Fehler beim Speichern des Rate-Limit-Status:', err));
        
        // Badge aktualisieren um Rate-Limit-Status anzuzeigen
        updateBadge();
      } else {
        console.warn('GitHub API Rate Limit erreicht (keine Reset-Zeit verfügbar)');
      }
      return true;
    }
  }
  return false;
}

/**
 * Prüft ob wir aktuell rate-limited sind
 */
function isRateLimited() {
  if (!rateLimitHit) return false;
  
  const now = Date.now();
  if (now >= rateLimitResetTime) {
    // Rate Limit ist abgelaufen
    rateLimitHit = false;
    rateLimitResetTime = 0;
    
    // Rate-Limit-Status zurücksetzen
    browser.storage.local.set({ 
      rateLimitHit: false, 
      rateLimitResetTime: 0 
    }).catch(err => console.error('Fehler beim Zurücksetzen des Rate-Limit-Status:', err));
    
    console.log('GitHub API Rate Limit zurückgesetzt');
    updateBadge(); // Badge zurücksetzen
    return false;
  }
  
  const minutesLeft = Math.ceil((rateLimitResetTime - now) / 60000);
  console.debug(`Rate Limit aktiv, noch ${minutesLeft} Minuten bis Reset`);
  return true;
}

/**
 * Exponential Backoff bei Fehlern
 */
async function exponentialBackoff(attempt, maxAttempts = 3) {
  if (attempt >= maxAttempts) {
    throw new Error('Maximale Anzahl an Versuchen erreicht');
  }
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 Sekunden
  console.debug(`Warte ${delay}ms vor erneutem Versuch (Versuch ${attempt + 1}/${maxAttempts})`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Ruft alle Kommentare für ein Issue ab
 */
async function fetchIssueComments(issueNumber, attempt = 0) {
  try {
    // Rate Limit Check
    if (isRateLimited()) {
      return [];
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      if (handleRateLimit(response)) {
        return [];
      }
      
      // Bei anderen Fehlern: Exponential Backoff
      if (attempt < 2) {
        await exponentialBackoff(attempt);
        return fetchIssueComments(issueNumber, attempt + 1);
      }
      
      return [];
    }

    const comments = await response.json();
    return Array.isArray(comments) ? comments : [];
  } catch (e) {
    console.error(`Fehler beim Laden von Kommentaren für Issue #${issueNumber}:`, e);
    
    // Bei Netzwerkfehlern: Exponential Backoff
    if (attempt < 2 && (e.name === 'TypeError' || e.name === 'NetworkError')) {
      await exponentialBackoff(attempt);
      return fetchIssueComments(issueNumber, attempt + 1);
    }
    
    return [];
  }
}

/**
 * Ruft alle Issues (offen und geschlossen) vom GitHub Repository ab
 */
async function fetchAllIssues(attempt = 0) {
  const issues = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 20; // Erhöht, da wir jetzt auch geschlossene Issues laden

  while (page <= maxPages) {
    try {
      // Rate Limit Check
      if (isRateLimited()) {
        console.debug('Rate Limit aktiv, breche Issue-Laden ab');
        break;
      }

      const url = `${GITHUB_API_URL}?state=all&per_page=${perPage}&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!response.ok) {
        if (handleRateLimit(response)) {
          break;
        }
        
        // Bei anderen Fehlern: Exponential Backoff
        if (attempt < 2) {
          await exponentialBackoff(attempt);
          return fetchAllIssues(attempt + 1);
        }
        
        throw new Error(`GitHub API Fehler: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data) || data.length === 0) break;

      // Pull Requests herausfiltern
      for (const issue of data) {
        if (issue && !issue.pull_request) {
          issues.push(issue);
        }
      }

      // Prüfen ob es weitere Seiten gibt
      const linkHeader = response.headers.get('Link');
      if (!linkHeader || !linkHeader.includes('rel="next"')) {
        break;
      }

      page++;
    } catch (e) {
      console.error(`Fehler beim Laden von Seite ${page}:`, e);
      
      // Bei Netzwerkfehlern: Exponential Backoff
      if (attempt < 2 && page === 1 && (e.name === 'TypeError' || e.name === 'NetworkError')) {
        await exponentialBackoff(attempt);
        return fetchAllIssues(attempt + 1);
      }
      
      // Bei Fehler die bisher geladenen Issues zurückgeben
      break;
    }
  }

  return issues;
}

/**
 * Prüft schnell, ob sich die Anzahl der Issues geändert hat
 */
async function getIssueCount(attempt = 0) {
  try {
    // Rate Limit Check
    if (isRateLimited()) {
      return null;
    }

    const url = `${GITHUB_API_URL}?state=all&per_page=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    });

    if (!response.ok) {
      if (handleRateLimit(response)) {
        return null;
      }
      
      // Bei anderen Fehlern: Exponential Backoff
      if (attempt < 2) {
        await exponentialBackoff(attempt);
        return getIssueCount(attempt + 1);
      }
      
      return null;
    }

    // Aus dem Link-Header die Gesamtzahl extrahieren
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastPageMatch) {
        return parseInt(lastPageMatch[1], 10) * 100; // Ungefähre Anzahl
      }
    }

    // Fallback: Erste Seite laden und zählen
    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.error('Fehler beim Abrufen der Issue-Anzahl:', e);
    
    // Bei Netzwerkfehlern: Exponential Backoff
    if (attempt < 2 && (e.name === 'TypeError' || e.name === 'NetworkError')) {
      await exponentialBackoff(attempt);
      return getIssueCount(attempt + 1);
    }
    
    return null;
  }
}

/**
 * Baut die Domain-Liste aus GitHub Issues auf
 */
async function buildDomainList() {
  const domains = new Set();

  const issues = await fetchAllIssues();
  console.debug(`GitHub Issues geladen (offen + geschlossen): ${issues.length}`);

  for (const issue of issues) {
    try {
      const title = (issue.title || '').trim();
      const body = issue.body || '';

      // ALLE Domains aus dem Titel extrahieren
      if (title) {
        if (isFullUrl(title)) {
          const host = hostFromUrl(title);
          if (host) {
            domains.add(host);
          }
        } else {
          const hosts = extractAllHosts(title);
          for (const host of hosts) {
            domains.add(host);
          }
        }
      }

      // ALLE Domains aus dem Body extrahieren
      if (body) {
        const hosts = extractAllHosts(body);
        for (const host of hosts) {
          domains.add(host);
        }
      }

      // ALLE Domains aus den Kommentaren extrahieren
      if (issue.number && issue.comments > 0) {
        const comments = await fetchIssueComments(issue.number);
        for (const comment of comments) {
          if (comment && comment.body) {
            const hosts = extractAllHosts(comment.body);
            for (const host of hosts) {
              domains.add(host);
            }
          }
        }
      }
    } catch (err) {
      // Einzelne Issue-Fehler loggen aber weitermachen
      console.warn('Fehler beim Verarbeiten eines Issues:', err);
    }
  }

  console.debug(`Extrahierte Domains: ${domains.size}`);
  return domains;
}

/**
 * Lädt die gecachte Domain-Liste aus dem Storage
 */
async function loadCachedDomainList() {
  try {
    const result = await browser.storage.local.get(['cachedDomains', 'lastFullReload', 'lastIssueCount']);
    
    if (result.cachedDomains && Array.isArray(result.cachedDomains) && result.cachedDomains.length > 0) {
      knownDomains = new Set(result.cachedDomains);
      console.log(`Gecachte Domain-Liste geladen: ${knownDomains.size} Domains`);
      return {
        lastFullReload: result.lastFullReload || 0,
        lastIssueCount: result.lastIssueCount || 0
      };
    }
    return { lastFullReload: 0, lastIssueCount: 0 };
  } catch (err) {
    console.error('Fehler beim Laden der gecachten Domain-Liste:', err);
    return { lastFullReload: 0, lastIssueCount: 0 };
  }
}

/**
 * Speichert die Domain-Liste im Cache
 */
async function saveDomainListToCache(domains) {
  try {
    const issueCount = await getIssueCount();
    await browser.storage.local.set({
      cachedDomains: Array.from(domains),
      lastFullReload: Date.now(),
      lastIssueCount: issueCount || 0
    });
    console.log('Domain-Liste im Cache gespeichert');
  } catch (err) {
    console.error('Fehler beim Speichern der Domain-Liste:', err);
  }
}

/**
 * Lädt die Domain-Liste direkt von GitHub (nur wenn nötig)
 */
async function fetchDomainList(forceReload = false) {
  try {
    // Rate Limit Check vor allen Operationen
    if (isRateLimited() && !forceReload) {
      console.debug('Rate Limit aktiv, überspringe Prüfung');
      return;
    }

    const cache = await loadCachedDomainList();
    const now = Date.now();
    
    // Prüfe ob ein vollständiger Reload nötig ist
    let needsReload = forceReload;
    
    // Fall 1: Keine gecachte Liste oder Liste ist leer
    if (knownDomains.size === 0) {
      console.log('Keine gecachte Domain-Liste vorhanden, lade komplett neu');
      needsReload = true;
    }
    
    // Fall 2: Letzter vollständiger Reload ist zu lange her
    else if (cache.lastFullReload && (now - cache.lastFullReload > FULL_RELOAD_MIN_INTERVAL_MS)) {
      console.log('Letzter vollständiger Reload ist älter als 24h, lade neu');
      needsReload = true;
    }
    
    // Fall 3: Prüfe ob es neue Issues gibt (nur wenn kein Reload erzwungen wurde)
    else if (!forceReload) {
      const currentIssueCount = await getIssueCount();
      if (currentIssueCount !== null && currentIssueCount !== cache.lastIssueCount) {
        console.log(`Issue-Anzahl hat sich geändert (${cache.lastIssueCount} → ${currentIssueCount}), lade neu`);
        needsReload = true;
      } else if (currentIssueCount !== null) {
        console.log(`Keine neuen Issues, verwende Cache (${knownDomains.size} Domains)`);
      }
    }

    // Nur neu laden wenn nötig
    if (needsReload) {
      const domains = await buildDomainList();

      // Nur aktualisieren wenn wir mindestens eine Domain haben
      if (domains.size > 0) {
        knownDomains = domains;
        await saveDomainListToCache(domains);
        console.log(`Domain-Liste vollständig neu geladen: ${knownDomains.size} Domains`);
      } else {
        console.warn('Keine Domains geladen, behalte alte Liste');
      }
    }
  } catch (err) {
    console.error('Fehler beim Abrufen der Domain-Liste:', err);
    // Bei Fehler die alte Liste behalten
  }
}

/**
 * Prüft, ob die übergebene Domain in der geladenen Liste vorhanden ist.
 *
 * @param {string} host Die besuchte Domain
 * @returns {boolean} True, wenn die Domain in der Liste enthalten ist
 */
function isListed(host) {
  try {
    const normalizedHost = normalizeDomain(host);

    if (!normalizedHost) {
      return false;
    }

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
  } catch (e) {
    console.error('Fehler in isListed:', e);
    return false;
  }
}

/**
 * Aktualisiert die Badge‑Anzeige am Erweiterungsicon.
 */
function updateBadge() {
  try {
    // Rate-Limit-Status hat Vorrang (nur wenn tatsächlich aktiv)
    if (rateLimitHit && Date.now() < rateLimitResetTime) {
      browser.browserAction.setBadgeText({ text: '!' });
      browser.browserAction.setBadgeBackgroundColor({ color: '#FFA726' });
      return;
    }
    
    // Normal: Anzahl ungelisteter Domains
    const count = unmatchedSites.size;
    const text = count > 0 ? String(count) : '';
    browser.browserAction.setBadgeText({ text });
    if (count > 0) {
      browser.browserAction.setBadgeBackgroundColor({ color: '#E57373' });
    } else {
      // Wichtig: Hintergrundfarbe zurücksetzen wenn keine ungelisteten Domains
      browser.browserAction.setBadgeBackgroundColor({ color: '#4CAF50' });
    }
  } catch (e) {
    console.error('Fehler beim Aktualisieren der Badge:', e);
  }
}

/**
 * Verarbeitet eine besuchte URL und prüft, ob die Domain gelistet ist
 */
function processUrl(urlString) {
  try {
    // Sicherheitsprüfung
    if (!urlString || typeof urlString !== 'string') {
      return;
    }

    const url = new URL(urlString);
    const host = url.hostname;

    // Bei file://, about:, data: etc. keine Prüfung
    if (!host || host === '' || url.protocol === 'file:' || url.protocol === 'about:' || url.protocol === 'data:' || url.protocol === 'moz-extension:') {
      return;
    }

    // Sicherstellen dass knownDomains initialisiert ist
    if (!knownDomains || !(knownDomains instanceof Set)) {
      console.warn('knownDomains nicht initialisiert, überspringe Prüfung');
      return;
    }

    if (!isListed(host)) {
      // Domain als nicht gelistet merken
      if (!unmatchedSites.has(host)) {
        unmatchedSites.add(host);
        // Persistieren mit Fehlerbehandlung
        browser.storage.local.set({ unmatchedSites: Array.from(unmatchedSites) })
          .catch(err => console.error('Fehler beim Speichern:', err));
        updateBadge();
        console.debug(`Neue ungelistete Domain erkannt: ${host}`);
      }
    }
  } catch (e) {
    // Fehlerhafte URLs ignorieren aber loggen für Debug
    console.warn('Konnte URL nicht verarbeiten:', urlString, e);
  }
}

/**
 * Listener für Tab-Updates (nur wenn fullMonitoring aktiviert ist)
 */
function onTabUpdated(tabId, changeInfo, tab) {
  try {
    if (changeInfo.url) {
      processUrl(changeInfo.url);
    }
  } catch (e) {
    console.error('Fehler in onTabUpdated:', e);
  }
}

/**
 * Registriert oder entfernt den Tab-Update-Listener basierend auf der Einstellung
 */
function updateListeners() {
  if (fullMonitoring) {
    // Vollständige Überwachung: Tab-Updates hinzufügen
    if (!browser.tabs.onUpdated.hasListener(onTabUpdated)) {
      browser.tabs.onUpdated.addListener(onTabUpdated);
      console.debug('Vollständige Überwachung aktiviert (inkl. Tab-Updates)');
    }
  } else {
    // Nur Navigation: Tab-Updates entfernen
    if (browser.tabs.onUpdated.hasListener(onTabUpdated)) {
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      console.debug('Reduzierte Überwachung aktiviert (nur Navigation)');
    }
  }
}

/**
 * Initialisiert die Erweiterung
 */
async function init() {
  try {
    console.log('TheySoldMyEmail Checker wird initialisiert...');

    // Geladene unlisted Sites und Rate-Limit-Status aus dem lokalen Speicher übernehmen
    const result = await browser.storage.local.get(['unmatchedSites', 'fullMonitoring', 'rateLimitHit', 'rateLimitResetTime']);
    const stored = result.unmatchedSites || [];
    unmatchedSites = new Set(stored);
    fullMonitoring = result.fullMonitoring || false; // Standard: nur Navigation
    
    // Rate-Limit-Status wiederherstellen
    rateLimitHit = result.rateLimitHit || false;
    rateLimitResetTime = result.rateLimitResetTime || 0;
    
    updateBadge();

    console.log(`Überwachungsmodus: ${fullMonitoring ? 'Vollständig' : 'Reduziert'}`);

    // Liste laden (verwendet Cache wenn möglich)
    await fetchDomainList();

    // Eventlistener für jede neue Navigation (nur Hauptframe) - immer aktiv
    browser.webNavigation.onCommitted.addListener((details) => {
      try {
        if (details.frameId !== 0) {
          return;
        }
        processUrl(details.url);
      } catch (e) {
        console.error('Fehler in webNavigation.onCommitted:', e);
      }
    });

    // Listener basierend auf Einstellung registrieren
    updateListeners();

    function queryTabs(queryInfo) {
      return new Promise((resolve) => {
        chrome.tabs.query(queryInfo, resolve);
      });
    }

    // Beispiel mit async/await
    if (fullMonitoring) {
      const tabs = await queryTabs({});
      for (const tab of tabs) {
        if (tab.url) {
          processUrl(tab.url);
        }
      }
      console.debug('Initiale Tab-Prüfung durchgeführt (vollständige Überwachung)');
    } else {
      console.debug('Keine initiale Tab-Prüfung (reduzierte Überwachung)');
    }

    // Auf Änderungen der Einstellung reagieren
    browser.storage.onChanged.addListener((changes, area) => {
      try {
        if (area === 'local' && changes.fullMonitoring) {
          fullMonitoring = changes.fullMonitoring.newValue;
          updateListeners();
        }
      } catch (e) {
        console.error('Fehler in storage.onChanged:', e);
      }
    });

    // Regelmäßige Prüfung auf neue Issues (aber nicht vollständiges Reload)
    setInterval(() => fetchDomainList(false), CHECK_INTERVAL_MS);

    console.log('TheySoldMyEmail Checker erfolgreich initialisiert');
  } catch (e) {
    console.error('Fataler Fehler bei Initialisierung:', e);
  }
}

// Startpunkt
init();