# HoodPlaka67 Image Studio V2

Lokale Browser-Web-App für Bildverbesserung, Retusche, Freistellung, Upscaling, Batch-Verarbeitung und Druckvorbereitung. Bilddaten bleiben im Browser; externe Bibliotheken werden nur für Dateiformate/ZIP geladen.

## Kernfunktionen

- JPG, PNG, WebP, AVIF, GIF (erster Frame), BMP, TIFF, HEIC/HEIF, SVG und ICO – abhängig vom Browser/Decoder
- Before/After-Vergleich, Histogramm, Bildanalyse und Warnungen
- Presets für Kundenfertig, Produkt, Portrait, Grafik/Text, Print, Web und S/W
- Belichtung, Helligkeit, Kontrast, Lichter, Tiefen, Weiß, Schwarz, Gamma
- Weiß-/Beige-Korrektur, Temperatur, Tönung, Farbton, Vibrance und Sättigung
- Denoise, Sharpen, Klarheit, Dehaze, Blur, Vignette, Grain und Pixelate
- 1×/2×/4×/8× sowie Custom-Upscale mit Browser-Sicherheitsgrenzen
- Rotate, Straighten, Flip, Crop, Resize, Canvas Padding und Druckgrößen
- Edge-basierte Hintergrundentfernung, Hintergrundfarbe und Hintergrund-Blur
- Heal-, Clone-, Eraser- und Restore-Pinsel
- Filter, Sticker-Outline, Rahmen und Text/Wasserzeichen
- Undo/Redo pro Bild, Custom-Preset, Batch-Processing und Batch-ZIP
- PNG-DPI-Metadaten, TIFF/PNG verlustfrei, JPG/WebP/AVIF browserabhängig
- PWA-Grundlage mit Manifest und Service Worker

## Ehrliche Grenzen

Die App verwendet derzeit **keine Cloud-Generative-AI und kein eingebettetes großes Super-Resolution-Modell**. Funktionen wie generatives Ersetzen, semantische Objektmasken, generatives Expand oder echte KI-Rekonstruktion fehlender Details benötigen ein separates Modell/API und werden nicht vorgetäuscht. Das aktuelle Upscaling ist hochwertiges Browser-Resampling; Face Enhance nutzt nur den browserseitigen `FaceDetector`, wenn verfügbar.

## Start

Statische Dateien ausliefern, z. B.:

```bash
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Qualitätssicherung

```bash
node --check app-v2.js
python3 scripts/validate.py
```

GitHub Actions führt zusätzlich einen lokalen HTTP-Smoke-Test durch und erzeugt ein fertiges Website-Artefakt.
