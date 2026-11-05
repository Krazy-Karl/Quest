// Génère index.html (version autonome pour GitHub Pages) et dist/artifact.html (version claude.ai) depuis src/app.html.
import fs from 'node:fs';
const app = fs.readFileSync('src/app.html', 'utf8');
const i = app.lastIndexOf('<script>');
if (i < 0) throw new Error('script de l’application introuvable dans src/app.html');
const tags = '<!--STANDALONE-->\n<script src="firebase-config.js"></script>\n<script src="standalone/firebase-bundle.js"></script>\n<script src="standalone/shim.js"></script>\n<!--/STANDALONE-->\n';
const page = app.slice(0, i) + tags + app.slice(i);
fs.writeFileSync('index.html', '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + page + '\n</body></html>\n');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', app);
console.log('index.html et dist/artifact.html générés');
