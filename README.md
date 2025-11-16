# TheySoldMyEmail Checker

Browser-Erweiterung zur Unterstützung des Projekts **TheySoldMyEmail**.

Die Erweiterung hilft dabei, neue potenzielle Kandidaten-Domains zu identifizieren, ohne selbst sensible oder personenbezogene Daten zu übertragen.  
Sie richtet sich an Personen, die das Hauptprojekt bei der Suche nach Diensten unterstützen möchten, die E-Mail-Adressen weitergeben oder verkaufen.

---

## Architektur (aktuelle Version)

Frühere Versionen der Erweiterung haben eine vorverarbeitete Domainliste von einem eigenen Server (`issue_urls.txt`) geladen.  
In der aktuellen Version entfällt diese serverseitige Komponente vollständig:

- Die Erweiterung nutzt direkt die **GitHub-API**, um die öffentlichen Issues des Hauptprojekts _TheySoldMyEmail_ abzurufen.
- Aus diesen Issues wird **im Browser** eine Referenzliste bekannter Domains erzeugt.
- Es gibt keinen projekt-eigenen Server mehr – alle externen Anfragen gehen ausschließlich an GitHub.

Dadurch wird die Architektur einfacher, transparenter und weniger fehleranfällig.

---

## Versionshinweis (1.1 / 1.2)

Die Versionen **1.1** und **1.2** der Erweiterung basieren noch auf der Übergangs Architektur mit zentralem Server:

- Diese Versionen verwenden weiterhin die vom Server bereitgestellte Datei `issue_urls.txt`.
- Sie werden nur noch für eine **Übergangszeit** funktionsfähig bleiben.
- Sobald sich der neue GitHub-API-basierte Ansatz auch im **Langzeittest** bewährt hat, wird der alte Server **dauerhaft abgeschaltet**.

Nach der Abschaltung des Servers:

- funktionieren die Versionen **1.1** und **1.2** nicht mehr wie vorgesehen (die Synchronisation der Domainliste bricht weg),
- wird **dringend empfohlen**, auf die aktuelle Version der Erweiterung zu aktualisieren, die ausschließlich die GitHub-API nutzt.

---

## Funktionsweise

### 1. Referenzliste aus GitHub

- Beim Start (und in definierten Abständen) ruft das Add-on über die GitHub-API die öffentlichen Issues des Projekts TheySoldMyEmail ab.
- Aus Betreff/Text der Issues wird eine normalisierte Liste bekannter Domains/Dienste erzeugt.
- Diese Liste dient ausschließlich als lokale Referenz für spätere Abgleiche.

### 2. Prüfung besuchter Seiten

Bei jedem Seitenaufruf wird die aktuell besuchte URL verarbeitet:

- Protokoll wird entfernt (z. B. `https://`).
- Gängige Präfixe wie `www.` werden entfernt.
- Groß-/Kleinschreibung wird vereinheitlicht.
- Es wird auf die relevante Domain / den relevanten Hostanteil reduziert.

Die so normalisierte Domain wird anschließend mit der lokal gehaltenen Referenzliste aus GitHub abgeglichen.

### 3. Erkennung neuer Kandidaten

- Ist eine Domain **nicht** in der Referenzliste enthalten, kann sie als potenzieller neuer Kandidat lokal vorgemerkt werden.
- Diese potenziellen Kandidaten bilden die Grundlage, um neue Einträge für das Hauptprojekt zu finden.
- Es erfolgt **keine automatische Übermittlung** dieser Daten an GitHub oder andere Server.

### 4. Anzeige im Add-on

- Das Symbol des Add-ons kann die Anzahl aktuell offener Kandidaten als Badge anzeigen.
- Über das Popup lassen sich erkannte Domains:
  - einsehen,
  - bereinigen,
  - verwerfen.
- Relevante Einträge können durch die Nutzenden manuell an das TheySoldMyEmail-Projekt gemeldet werden (z. B. per GitHub-Issue).

---

## Datenschutz

Die Erweiterung ist bewusst datensparsam konzipiert:

- Es werden **keine vollständigen Surfverläufe** aufgezeichnet oder übertragen.
- Es werden **keine gesammelten Domains oder Kandidaten automatisch** an Server oder Dritte gesendet.
- Die einzigen externen Anfragen sind:
  - Aufrufe der **öffentlichen GitHub-API** des TheySoldMyEmail-Repositories.
- Alle erkannten potenziellen Kandidaten verbleiben lokal im Browser, bis Nutzende diese freiwillig und manuell melden.

---

## Beitrag zum TheySoldMyEmail-Projekt

So unterstützt die Erweiterung das Hauptprojekt indirekt:

1. Erweiterung installieren.
2. Wie gewohnt im Web surfen.
3. In regelmäßigen Abständen das Popup öffnen und prüfen:
   - Welche neuen Domains wurden erkannt?
   - Welche davon gehören zu Diensten, bei denen individuelle Adressen verwendet wurden?
4. Relevante Dienste manuell als Issue im TheySoldMyEmail-Repository melden.

Die Erweiterung nimmt keine automatische Bewertung der Dienste vor – die inhaltliche Einordnung und Meldung bleibt bewusst beim Menschen.

---

## Installation

### Installation aus Release-Build (Firefox)

1. Die aktuelle `.xpi`-Datei aus den Releases dieses Repositories herunterladen.
2. In Firefox:
   - Menü öffnen → **Add-ons und Themes**
   - Zahnrad-Symbol → **Add-on aus Datei installieren…**
   - Heruntergeladene `.xpi` auswählen und Installation bestätigen.

### Installation für Entwicklung / Tests

1. Repository lokal klonen.
2. Firefox öffnen und `about:debugging#/runtime/this-firefox` aufrufen.
3. **„Temporäres Add-on laden“** auswählen.
4. Die `manifest.json` aus dem geklonten Repository auswählen.

Die Erweiterung wird dann temporär geladen und kann während der Entwicklung getestet werden.

---

## Hinweise & Haftungsausschluss

- Die Erweiterung greift ausschließlich auf öffentlich zugängliche Daten (GitHub-Issues) zu.
- Es wird keine Garantie für Vollständigkeit oder Korrektheit der ermittelten Domains gegeben.
- Die Nutzung erfolgt auf eigenes Risiko; rechtliche Bewertungen der gefundenen Fälle sind nicht Bestandteil dieses Projekts.

Pull Requests, Verbesserungsvorschläge und Fehlerberichte zur Erweiterung sind jederzeit willkommen.
