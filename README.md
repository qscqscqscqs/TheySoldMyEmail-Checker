# TheySoldMyEmail Checker

Browser-Erweiterung zur Unterstützung des Projekts [TheySoldMyEmail](https://github.com/svemailproject/TheySoldMyEmail).

Die Erweiterung hilft dabei, neue potenzielle Kandidaten-Domains zu identifizieren, ohne selbst sensible oder personenbezogene Daten zu übertragen.

Mit der neuen Version der Erweiterung wurde die interne Logik vollständig überarbeitet:  
Die Liste der relevanten Domains wird nicht mehr im Add-on selbst dynamisch erzeugt, sondern zentral auf dem Server aufbereitet und als fertige Referenzliste bereitgestellt:

`http://addons.qscqscqscqs.de/issue_urls.txt`

Dadurch werden frühere Stabilitätsprobleme vermieden, die durch die aufbereitung der Quellen im Addon entstanden sind.

---

## Funktionsweise

### 1. Zentrale Referenzliste

- Beim Start (und in definierten Abständen) ruft das Add-on die Datei `issue_urls.txt` vom Server ab.
- Diese Datei enthält eine bereits normalisierte und kuratierte Liste bekannter Domains aus dem TheySoldMyEmail-Kontext.
- Die Liste wird ausschließlich zum lokalen Abgleich verwendet.

### 2. Prüfung besuchter Seiten

- Bei jedem Seitenaufruf wird die aktuelle URL verarbeitet:
  - Protokoll wird entfernt (z. B. `https://`),
  - gängige Präfixe wie `www.` werden entfernt,
  - Groß-/Kleinschreibung wird vereinheitlicht.
- Die so normalisierte Domain wird mit der geladenen Referenzliste abgeglichen.

### 3. Erkennung neuer Kandidaten

- Ist eine Domain **nicht** in der Referenzliste enthalten, kann sie als potenzieller neuer Kandidat lokal vorgemerkt werden.
- Diese potenziellen Kandidaten dienen als Grundlage, um neue Einträge für das Hauptprojekt zu finden.
- Es erfolgt **keine** automatische Übermittlung dieser Daten.

### 4. Anzeige im Add-on

- Das Symbol des Add-ons kann die Anzahl offener Kandidaten als Badge anzeigen.
- Über das Popup lassen sich erkannte Domains einsehen, bereinigen oder verwerfen.
- Relevante Einträge können von den Nutzenden manuell an das Hauptprojekt gemeldet werden.

---

## Datenschutz

Die Erweiterung ist bewusst datensparsam konzipiert:

- Es werden **keine** vollständigen Surfverläufe aufgezeichnet oder übertragen.
- Es werden **keine** gesammelten Domains oder Kandidaten automatisch an Server oder Dritte gesendet.
- Die einzige externe Anfrage ist der Download der öffentlichen Datei `issue_urls.txt`.
- Alle erkannten potenziellen Kandidaten verbleiben lokal im Browser, bis Nutzende diese freiwillig und manuell melden.

---

## Beitrag zum TheySoldMyEmail-Projekt

Die Erweiterung unterstützt das Projekt indirekt:

1. Erweiterung installieren.
2. Normal im Web surfen.
3. In regelmäßigen Abständen das Popup öffnen und prüfen:
   - Welche neuen Domains wurden erkannt?
   - Welche davon gehören zu Diensten, bei denen individuelle Adressen verwendet wurden?
4. Relevante Dienste manuell als Issue im [TheySoldMyEmail-Repository](https://github.com/svemailproject/TheySoldMyEmail) melden.
---

## Installation

### Aus Release-Build

1. Aktuelle `.xpi`-Datei aus den Releases dieses Repositories herunterladen.
2. In Firefox:
   - Menü öffnen → **Add-ons und Themes**
   - Zahnrad-Symbol → **Add-on aus Datei installieren…**
   - `.xpi` auswählen und Installation bestätigen.
