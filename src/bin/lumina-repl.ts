#!/usr/bin/env node
import path from 'node:path';
import { runLumina, setDefaultStdPath } from './lumina-core.js';

const currentDir = path.dirname(process.argv[1] ? path.resolve(process.argv[1]) : process.cwd());
setDefaultStdPath(path.resolve(currentDir, '..', '..', 'std'));

void runLumina(['repl', ...process.argv.slice(2)]);
