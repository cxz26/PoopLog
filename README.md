# PoopLog

Your offline-first bowel movement tracker. Private, fast, and easy to use.

## Features

- **Offline First**: All data is stored locally in your browser using IndexedDB.
- **Privacy Focused**: No tracking, no accounts, no server data collection.
- **Quick Logging**: Log your movements in seconds with an intuitive UI.
- **Bristol Scale**: Track consistency using the Bristol Stool Scale.
- **Statistics**: View insights and trends over time.
- **PWA Ready**: Install it as an app on your phone or desktop.
- **Export/Import**: Backup your data anytime (JSON, CSV, PDF).
- **Secure**: Optional PIN lock and "Hide sensitive data" feature.

## Development

This is a Vite + React (TypeScript) project.

\`\`\`bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build
\`\`\`

Run `npm run lint` before a release. The production build is written to `dist/`.

## Optional cloud backup

Cloud backup is disabled unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured in a local `.env` file. Copy `.env.example` and follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Never commit `.env` files.

## Data and privacy

Logs are stored in the browser's IndexedDB. JSON backups preserve logs, daily check-ins, and custom tags. Exported data is private health information—store it securely.

## Release checks

Test empty and populated states, import/export round trips, deletion confirmations, offline behavior, and mobile/desktop layouts before publishing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License. See [LICENSE](LICENSE).
