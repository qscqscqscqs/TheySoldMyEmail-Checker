# TheySoldMyEmail Checker

Erweiterung für Firefox, die das Projekt [TheySoldMyEmail](https://github.com/svemailproject/TheySoldMyEmail) beim schnelleren Finden neuer potenzieller Kandidaten unterstützt.

Die Erweiterung prüft besuchte Websites gegen die öffentliche TheySoldMyEmail-Liste und sammelt lokal Domains, die dort noch nicht enthalten sind. So können Unterstützerinnen und Unterstützer gezielt neue Dienste an das Projekt melden.

---

## Funktionsumfang

- **Abgleich mit bestehender Liste**  
  Beim Laden einer Seite wird die Domain gegen die im Projekt gepflegte Übersichtsliste (GitHub Issue #98) geprüft.

- **Erkennung neuer Kandidaten**  
  Domains, die nicht in der Liste vorkommen, werden lokal als „ungelistete Vorschläge“ gespeichert.

- **Badge-Anzeige**  
  Das Add-on-Icon zeigt die Anzahl aktuell erkannter, noch nicht gemeldeter Domains als Badge an.

- **Übersicht im Popup**  
  Ein Klick auf das Icon öffnet ein Popup mit allen gesammelten Domains.  
  Von dort aus können Einträge überprüft und die Liste bei Bedarf geleert werden.

Dieses Add-on übermittelt keine Daten automatisiert an das Projekt. Es unterstützt ausschließlich dabei, mögliche neue Einträge schneller zu identifizieren.

---

## So unterstützt die Erweiterung das Projekt

1. Add-on installieren.
2. Wie gewohnt im Web surfen.
3. Regelmäßig das Popup öffnen:
   - Die aufgelisteten Domains prüfen.
   - Relevante Dienste als Vorschlag im Hauptrepository melden:
     - Neues Issue in [`svemailproject/TheySoldMyEmail`](https://github.com/svemailproject/TheySoldMyEmail/issues) erstellen.
     - Domain(s) aus dem Popup übernehmen.
     - Kurz beschreiben, worum es bei dem Dienst geht (z. B. Newsletter, Shop, SaaS, Forum).

Auf diese Weise entsteht aus normaler Nutzung heraus eine qualitativ bessere Vorschlagsliste, ohne dass personenbezogene Daten geteilt werden.

---

## Installation

### Aus der `.xpi`-Datei

1. Die aktuelle `.xpi`-Datei dieses Repositories herunterladen.
2. In Firefox:
   - Menü öffnen → **Add-ons und Themes** → Zahnrad-Menü → **Add-on aus Datei installieren…**.
   - Die `.xpi`-Datei auswählen und Installation bestätigen.
