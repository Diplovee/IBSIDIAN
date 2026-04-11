import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod', 'fonts');
const targetDir = path.join(rootDir, 'public', 'excalidraw', 'fonts');

await mkdir(path.dirname(targetDir), { recursive: true });
await cp(sourceDir, targetDir, { recursive: true, force: true });
