Navee Scooter Tuner - Installations- & Bedienungsanleitung
===========================================================

Mit diesen Dateien hast du dein eigenes, voll funktionsfähiges Web-Bluetooth-Dashboard, 
das speziell für die Navigation und das Flashen von Navee E-Scootern (wie z. B. dem V25i Pro, ST3 Pro, V40 und GT3) optimiert ist.

Inhalt des Ordners:
-------------------
1. `index.html` - Struktur und Schaltflächen für den Browser
2. `style.css`  - Das sportliche, moderne Carbon- & Neon-Design
3. `app.js`     - Die Bluetooth-Schnittstelle und Programmierlogik für dein Handy

So bringst du die App auf dein Smartphone (Android / Chrome):
-------------------------------------------------------------

Da Handys aus Sicherheitsgründen die Bluetooth-Schnittstelle (Web Bluetooth API) 
NUR auf verschlüsselten Webseiten zulassen, hast du zwei sehr einfache, kostenlose Möglichkeiten, diese Dateien zu nutzen:

Möglichkeit A: Kostenloses Hosting über GitHub Pages (Empfohlen!)
1. Erstelle ein kostenloses Konto auf GitHub (github.com).
2. Erstelle ein neues, öffentliches Repository (z. B. mit dem Namen "navee-tuner").
3. Lade diese drei Dateien (index.html, style.css, app.js) dort hoch.
4. Gehe in deinem Repository auf "Settings" (Einstellungen) -> "Pages" und wähle im Bereich "Build and deployment" den "main"-Branch aus und klicke auf "Save".
5. Nach 1-2 Minuten erhältst du einen Link (z. B. https://deinname.github.io/navee-tuner/).
6. Öffne diesen Link im Google Chrome Browser auf deinem Android-Handy und lege direkt los!

Möglichkeit B: Lokaler Server am PC (zum Testen vorab)
- Falls du Visual Studio Code installiert hast, nutze das Plugin "Live Server".
- Alternativ kannst du mit Python im Ordner über die Konsole einen Server starten:
  `python -m http.server 8000`
  Öffne dann am Handy oder PC `http://localhost:8000`.

Bedienung & Tuning für den Navee V25i Pro:
------------------------------------------
1. Schalte das Bluetooth an deinem Smartphone an.
2. Starte deinen Navee V25i Pro.
3. Drücke auf der Webseite auf "Scooter verbinden (Bluetooth)" und wähle deinen Scooter in der Popup-Liste aus.
4. Sobald der Status auf "Verbunden" steht, kannst du das gewünschte Limit (z. B. 35 km/h oder 40 km/h) und Zero Start einstellen.
5. Wähle eine Tastenkombination (z. B. 5x Bremse) aus. Das sorgt dafür, dass das Tuning im Alltag unsichtbar bleibt. Erst wenn du beim Einschalten des Scooters 5-mal die Bremse betätigst, wird der modifizierte Modus gestartet.
6. Klicke auf "Flash Custom Firmware" und warte, bis der Balken 100% erreicht hat.

Viel Spaß beim Tunen deines Navee V25i Pro!
