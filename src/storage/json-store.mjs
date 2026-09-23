import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Синхронные операции достаточны для одного процесса локального прототипа.
export function createStore(file) {
  mkdirSync(dirname(file), { recursive: true });
  return {
    read() { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []; },
    write(tasks) {
      writeFileSync(`${file}.tmp`, JSON.stringify(tasks, null, 2), 'utf8');
      renameSync(`${file}.tmp`, file);
    },
  };
}
