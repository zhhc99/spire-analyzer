import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const webDist = path.join(dist, 'web');
const cliDist = path.join(dist, 'cli');

await rm(dist, { force: true, recursive: true });
await mkdir(webDist, { recursive: true });
await mkdir(cliDist, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(webDist, 'index.html'));
await cp(path.join(root, 'src', 'web'), path.join(webDist, 'src', 'web'), { recursive: true });
await cp(path.join(root, 'src', 'core'), path.join(webDist, 'src', 'core'), { recursive: true });
await cp(path.join(root, 'src', 'cli', 'main.js'), path.join(cliDist, 'main.js'));
await cp(path.join(root, 'src', 'core'), path.join(cliDist, 'core'), { recursive: true });
