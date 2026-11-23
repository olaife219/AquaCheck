# AquaCheck

A lightweight browser-based pH learning tool for Basic 7–9 students.

## Run locally

Serve `dist/` from an HTTPS-capable host to use the device camera. It has no dependency installation or build step.

## Structure

- `dist/modules/app.js` — page routing and screen rendering.
- `dist/modules/camera.js` — live camera access and cleanup.
- `dist/modules/colour.js` — colour sampling, quality checks and pH classification.
- `dist/modules/profile.js` — the pH 1–14 reference chart.
- `dist/modules/storage.js` — browser-local result storage.
- `dist/refactor.css` — active styles.

## Behaviour

Students prepare a strip, open the rear camera, take a photograph and receive an estimated pH, observed strip colour and acidity/alkalinity classification. Results remain on the device. Learn includes the pH scale, 6.5–8.5 pH range, clear-photo tips and an interactive challenge.

## Validation boundary

The colour reference came from the supplied strip-booklet photograph. It is not a laboratory calibration. The application rejects dark, glare-heavy, unclear and ambiguous matches, but it still needs validation against known-pH samples and a calibrated pH meter before reliance beyond a learning pilot.
