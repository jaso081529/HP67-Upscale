# HoodPlaka67 Image Enhancer

Lokale Browser-Web-App für **Bildaufwertung, Weiß-/Farbstich-Korrektur, Schärfe, Upscale, Before/After und Export**.

## Start

1. ZIP entpacken.
2. `index.html` per Doppelklick öffnen.
3. Falls der Browser lokale CDN-Skripte blockiert oder du HEIC/TIFF/ZIP nutzen willst, starte einen kleinen lokalen Webserver:

```bash
python -m http.server 8080
```

Dann im Browser `http://localhost:8080` öffnen.

Es gibt **keinen Account, keinen API-Key und keine Cloud-Verarbeitung**. Die Bilddateien selbst werden nicht hochgeladen. Drei JavaScript-Bibliotheken werden standardmäßig von jsDelivr geladen:
- JSZip: Batch-ZIP
- heic2any: HEIC/HEIF-Decoding
- UTIF.js: TIFF Import/Export

Wer komplett offline arbeiten will, kann diese drei Bibliotheken lokal herunterladen und die `<script src="...">`-Pfade in `index.html` auf lokale Dateien ändern.

## Standard-Ablauf

1. Bilder per Drag & Drop oder Dateiauswahl laden.
2. Job auswählen.
3. **Auto Kundenfertig** klicken.
4. Ergebnis mit dem **Before/After-Slider** prüfen.
5. Fit / 100 % / 200 % verwenden.
6. Exportformat wählen und exportieren.

## Was „Auto Kundenfertig“ macht

Die Pipeline arbeitet in dieser Reihenfolge:

1. Analyse von Helligkeit, Kontrast, Weißpunkt und Farbstich
2. Levels / Schwarzpunkt
3. Weißpunktkorrektur und gezielte Beige-/Warm-Off-White-Neutralisierung
4. Vibrance und Sättigung mit reduzierter Wirkung auf typische Hauttöne
5. Highlights / Shadows / Temperatur
6. optional Hintergrundentfernung
7. Denoise
8. Unsharp-Mask/Kantenschärfung
9. optional Face Enhance
10. Progressive HQ-Hochskalierung

Die Weißkorrektur versucht **nicht**, pauschal alle hellen Bildbereiche auf #FFFFFF zu zwingen. Sie gewichtet vor allem helle, wenig gesättigte, warm verschobene Flächen.

## Upscale

Die App verwendet standardmäßig **progressive hochwertige Browser-Resampling-Schritte**. Das ist zuverlässig, lokal und halluziniert keine neuen Motivdetails.

Aus Stabilitätsgründen gilt ein Sicherheitslimit von ungefähr:
- 70 Megapixel Ergebnis
- 16.384 px maximale Kantenlänge

Wenn 4× oder 8× darüber liegen würde, wird der Faktor sichtbar begrenzt und nicht heimlich ein kleineres Original ersetzt.

### Real-ESRGAN / ONNX / WebGPU

Die App ist absichtlich so gebaut, dass die Farb-/Weiß-/Schärfe-Pipeline ohne Modell funktioniert. Ein AI-Upscaler kann später **vor `upscaleCanvas()`** eingehängt werden. Empfohlene lokale Browser-Technik:
- ONNX Runtime Web + WebGPU/WASM
- Real-ESRGAN-kompatibles ONNX-Modell
- gekachelte Inferenz für große Bilder

Das Standard-Upscaling bleibt aktiv, bis ein echtes Modell eingebunden wurde; es gibt keinen Fake-AI-Schalter.

## Formate

### Import
Browser-nativ bzw. mit Decoder:
- JPG/JPEG
- PNG
- WebP
- AVIF, wenn Browser unterstützt
- GIF (erster dekodierter Frame)
- BMP, wenn Browser unterstützt
- SVG als Raster
- ICO, wenn Browser unterstützt
- TIFF/TIF über UTIF.js
- HEIC/HEIF über heic2any

Das Original-`File`-Objekt wird als Master gehalten und kann unverändert heruntergeladen werden.

### Export
- **PNG:** verlustfrei
- **TIFF:** verlustfrei über UTIF.js
- **JPG:** einstellbare Qualität
- **WebP:** Browser-Encoder mit gewählter Qualität; `quality=100` ist nicht in jedem Browser mathematisch lossless
- **AVIF:** nur wenn der Browser einen Canvas-Encoder anbietet

Die App weicht bei fehlendem Export-Codec **nicht heimlich** auf JPG aus.

## Transparenz

Alpha bleibt in PNG/TIFF erhalten. Hintergrund entfernen kann:
- transparent setzen
- auf reines Weiß `#FFFFFF` setzen

Die eingebaute Hintergrundentfernung ist eine **lokale, kantenbasierte Flood-Fill-Methode**. Sie ist für gleichmäßige Produkt-/Studiohintergründe gedacht und kein semantisches KI-Freistellmodell.

## Face Enhance

Face Enhance verwendet, wenn vorhanden, die Browser-API `FaceDetector`. Danach wird die erkannte Gesichtsregion leicht nachgeschärft. Wenn der Browser die API nicht unterstützt, wird das im Job vermerkt und es werden keine erfundenen Gesichtsdetails erzeugt.

## Regler

- Weißpunkt / Beige-Korrektur
- Vibrance
- Sättigung
- Kontrast
- Highlights
- Shadows
- Warm/Kalt
- Denoise
- Schärfe
- Upscale 1× / 2× / 4× / 8×
- Custom Zielbreite
- Face Enhance
- Hintergrund entfernen

## Presets

- Auto Kundenfertig
- Print 300 DPI
- Web
- Social
- Nur Farben
- Nur Upscale
- Nur Weiß/Farbstich

## Print 300 DPI

Unter der Analyse zeigt die App aus den **tatsächlichen Ergebnis-Pixeln** die mögliche Druckgröße bei 300 DPI in Zentimetern an.

## Große Dateien

Sehr große Bilder können an Browser-/GPU-/Canvas-Limits stoßen. Die App:
- behält das Original unverändert
- begrenzt nur das erzeugte Upscale-Ergebnis, wenn ein Browserlimit überschritten würde
- bricht bei zu großer Hintergrund-Flood-Fill-Verarbeitung mit verständlicher Meldung ab
- überschreibt das Original nie

## Dateistruktur

```text
hoodplaka-image-enhancer/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Wichtige Qualitätsentscheidung

Die App erfindet standardmäßig **keine neuen Gesichter, Buchstaben oder Motivdetails**. Ziel ist „treu + scharf + farblich sauber“, nicht generatives Halluzinieren.
