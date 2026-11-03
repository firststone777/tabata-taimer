# Tabata tAImer

Timer a intervalli (Tabata / HIIT) per iPhone, come PWA installabile da Safari. Niente pubblicità né abbonamenti; i dati restano sul telefono.

## Sviluppo

```sh
npm install
npm run dev      # http://localhost:5173 e in rete locale
npm test         # test del motore del timer, statistiche e backup
npm run build
```

- `npm run icons` rigenera icone e splash screen da `../assets/logo.png`.
- `powershell -File scripts/voice.ps1` rigenera le clip della voce guida (Windows, voce italiana).

La pubblicazione su GitHub Pages avviene a ogni push su `main` (`.github/workflows/deploy.yml`).
