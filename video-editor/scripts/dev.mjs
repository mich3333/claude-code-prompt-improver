// Development: Vite dev server with hot reload + Electron pointed at it.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import electron from 'electron';

const server = await createServer({ configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)) });
await server.listen();
const url = server.resolvedUrls.local[0];
server.printUrls();

const app = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
});
app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
