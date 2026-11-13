// The supervisor's engine with small programs of its own: the order of a start, what it says, and how it stops.

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { supervise } from '../runtime/supervise.mjs';

const folder = mkdtempSync(join(tmpdir(), 'supervise-test-'));
after(() => rmSync(folder, { recursive: true, force: true }));

// A program that runs `code` in Node; it stays up unless the code ends it.
const program = (label, code, extra = {}) => ({ label, command: [process.execPath, '-e', `${code}; setInterval(() => {}, 1000);`], ready: async () => true, ...extra });
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const ascii = (line) => /^[\x20-\x7e]*$/.test(line);

// Runs supervise with a fake process for its signals, and what it says kept; `then(control)` acts once it is
// ready, or at once when `atOnce`.
async function run({ programs, order, then = async () => {}, atOnce = false, ...options }) {
  const signals = new EventEmitter();
  const said = [];
  const control = { signals, said, ready: false, pids: [] };
  const logs = mkdtempSync(join(folder, 'logs-'));
  let readied;
  const isReady = new Promise((resolve) => {
    readied = resolve;
  });
  const status = supervise({
    programs,
    order,
    logs,
    say: (line) => said.push(line),
    signals,
    pollMs: 20,
    onReady: () => {
      control.ready = true;
      readied();
    },
    ...options,
  });
  control.logs = logs;
  if (atOnce) await then(control);
  else await Promise.race([isReady.then(() => then(control)), status]);
  control.status = await status;
  return control;
}

describe('supervise', () => {
  test('starts each stage once the stage before answers, says so when all answer, and stops all at SIGINT with status 0', async () => {
    const marks = join(folder, 'order');
    const t0 = Date.now();
    const control = await run({
      programs: {
        slow: program('the slow one', `require('fs').appendFileSync(${JSON.stringify(marks)}, 'slow ' + Date.now() + '\\n')`, { ready: async () => Date.now() - t0 > 300 }),
        next: program('the next one', `require('fs').appendFileSync(${JSON.stringify(marks)}, 'next ' + Date.now() + '\\n')`, { ready: async () => existsSync(marks) && readFileSync(marks, 'utf8').includes('next') }),
      },
      order: [['slow'], ['next']],
      then: async ({ signals }) => {
        signals.emit('SIGINT');
      },
    });
    assert.equal(control.status, 0);
    assert.ok(control.ready);
    const lines = readFileSync(marks, 'utf8').trim().split('\n').map((line) => line.split(' '));
    assert.deepEqual(lines.map(([name]) => name), ['slow', 'next']);
    assert.ok(Number(lines[1][1]) - t0 >= 300, 'the second stage started once the first answered');
    assert.deepEqual(control.said, ['Stopping ...']);
  });

  test('when a program stops by itself, says which, with its last lines made plain, stops the rest, and ends with status 1', async () => {
    let survivor;
    const control = await run({
      programs: {
        steady: program('the steady one', 'process.stdout.write(String(process.pid))'),
        brittle: { label: 'the brittle one', command: [process.execPath, '-e', 'console.log("first"); console.error("bröken \\x1b[31mred\\x1b[0m\\tline"); setTimeout(() => process.exit(3), 200)'], ready: async () => true },
      },
      order: [['steady', 'brittle']],
      then: async () => {},
    });
    assert.equal(control.status, 1);
    assert.equal(control.said[0], 'The brittle one stopped unexpectedly, with exit status 3.');
    assert.equal(control.said[1], 'The last lines it wrote:');
    assert.deepEqual(control.said.slice(2, 4), ['  first', '  br?ken red  line']);
    assert.equal(control.said.at(-1), 'Stopping everything ...');
    assert.ok(control.said.every(ascii), 'every line is plain ASCII');
    survivor = Number(readFileSync(join(control.logs, 'steady.log'), 'utf8'));
    assert.equal(alive(survivor), false, 'the other program is stopped');
  });

  test('kills a program that does not stop at SIGTERM once the grace is over', async () => {
    const started = Date.now();
    const control = await run({
      programs: { stubborn: program('the stubborn one', 'process.on("SIGTERM", () => {}); process.stdout.write(String(process.pid))') },
      order: [['stubborn']],
      graceMs: 300,
      then: async ({ signals }) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        signals.emit('SIGTERM');
      },
    });
    assert.equal(control.status, 0);
    assert.ok(Date.now() - started < 3000, 'it did not wait long');
    assert.equal(alive(Number(readFileSync(join(control.logs, 'stubborn.log'), 'utf8'))), false);
    assert.match(readFileSync(join(control.logs, 'supervisor.log'), 'utf8'), /stubborn started, pid \d+[\s\S]*stubborn killed, 300 ms after SIGTERM[\s\S]*stopped\n$/);
  });

  test('stops once its programs have exited, though something one of them started still holds its output, and kills that too', async () => {
    const started = Date.now();
    const control = await run({
      programs: {
        parent: program('the parent', `const child = require('child_process').spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'inherit' }); process.stdout.write(String(child.pid)); process.on('SIGTERM', () => process.exit(0))`),
      },
      order: [['parent']],
      graceMs: 60_000,
      then: async ({ signals }) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        signals.emit('SIGINT');
      },
    });
    assert.equal(control.status, 0);
    assert.ok(Date.now() - started < 5000, 'it did not wait for the grandchild');
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(alive(Number(readFileSync(join(control.logs, 'parent.log'), 'utf8'))), false, 'the grandchild is gone');
  });

  test('a second signal while stopping kills at once', async () => {
    const started = Date.now();
    const control = await run({
      programs: { stubborn: program('the stubborn one', 'process.on("SIGTERM", () => {})') },
      order: [['stubborn']],
      graceMs: 60_000,
      then: async ({ signals }) => {
        signals.emit('SIGINT');
        setTimeout(() => signals.emit('SIGINT'), 200);
      },
    });
    assert.equal(control.status, 0);
    assert.ok(Date.now() - started < 5000);
  });

  test('says which program did not answer in time, and ends with status 1', async () => {
    const control = await run({
      programs: { mute: program('the mute one', 'console.log("waiting")', { ready: async () => false }) },
      order: [['mute']],
      readyWithinMs: 300,
    });
    assert.equal(control.status, 1);
    assert.equal(control.said[0], 'The mute one did not answer within 0 seconds.');
    assert.deepEqual(control.said.slice(1, 3), ['The last lines it wrote:', '  waiting']);
  });

  test('is ready without waiting for a program in the background, and still stops when it fails later', async () => {
    const control = await run({
      programs: {
        front: program('the front', ''),
        back: { label: 'the background one', command: [process.execPath, '-e', 'setTimeout(() => process.exit(2), 400)'], ready: async () => false, background: true },
      },
      order: [['front', 'back']],
      then: async () => {},
    });
    assert.ok(control.ready, 'ready before the background program answered');
    assert.equal(control.status, 1);
    assert.equal(control.said[0], 'The background one stopped unexpectedly, with exit status 2.');
  });

  test('says when a program cannot be started at all', async () => {
    const control = await run({
      programs: { missing: { label: 'the missing one', command: ['/no/such/program'], ready: async () => true } },
      order: [['missing']],
    });
    assert.equal(control.status, 1);
    assert.match(control.said[0], /^The missing one stopped unexpectedly, it could not be started: .*ENOENT/);
  });
});
