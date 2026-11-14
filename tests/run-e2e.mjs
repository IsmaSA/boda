// npm test runner: backend unit tests, then a test build served locally with
// the Apps Script emulator, then the Playwright browser suite.
import { spawn, spawnSync } from 'node:child_process';

const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run('node', ['--test', 'tests/backend.test.mjs']);
run('node', ['scripts/build.mjs'], {
  OUT_DIR: '.test-dist',
  SITE_URL: 'http://localhost:8090/',
  RSVP_ENDPOINT: 'https://script.google.com/macros/s/TEST/exec',
});
const procs = [
  spawn('node', ['scripts/serve.mjs', '.test-dist'], { env: { ...process.env, PORT: '8090' }, stdio: 'ignore' }),
  spawn('node', ['tests/emulator-server.mjs'], { env: { ...process.env, PORT: '8788' }, stdio: 'ignore' }),
];
await new Promise((r) => setTimeout(r, 800));
const r = spawnSync('python3', ['tests/e2e.py'], { stdio: 'inherit' });
procs.forEach((p) => p.kill());
process.exit(r.status ?? 1);
