import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, '.env.example');
const target = path.join(root, '.env.local');

if (!fs.existsSync(source)) {
  console.error('Missing .env.example. Run this command from the repository root.');
  process.exit(1);
}

if (fs.existsSync(target)) {
  console.log('.env.local already exists; no file was overwritten.');
  process.exit(0);
}

fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
console.log('Created .env.local from .env.example.');
console.log('Edit .env.local, add your Neon connection string and replace every placeholder before running the application.');
