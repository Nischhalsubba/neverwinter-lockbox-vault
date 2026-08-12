import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const runNpm = (args) => {
  const result = spawnSync(npmCommand, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

runNpm(['--prefix', 'app', 'ci', '--no-audit', '--no-fund']);
runNpm(['--prefix', 'app', 'run', 'build']);

const appDist = resolve('app', 'dist');
const rootDist = resolve('dist');

if (!existsSync(appDist)) {
  throw new Error('Expected Vite output at app/dist, but the build did not create it.');
}

rmSync(rootDist, { recursive: true, force: true });
cpSync(appDist, rootDist, { recursive: true });

console.log('Deployment build ready at dist/');
