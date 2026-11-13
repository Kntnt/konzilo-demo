// Runs a set of programs as one: starts them stage by stage, each stage once the one before answers, says when
// all answer, and stops them all, promptly, at SIGINT or SIGTERM, or when one of them stops by itself, which is
// a failure: it says which, with the last lines it wrote. Nothing a program writes reaches the terminal but
// those lines, made plain; all of it goes to a log of the program's own, and what the supervisor did to each, with
// the time, to supervisor.log beside them.

import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';

import { plain } from './terminal.mjs';

// How much of each program's output is kept in memory, for its last lines.
const KEPT = 64 * 1024;

const capitalised = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `programs`: by name, { label, command, environment, ready, background }. `order`: the stages, each a list of
// names. `say`: prints a line. `onStarting(names)`: before each stage. `onReady()`: when every program but those
// in the background answers. Resolves to the exit status: 0 for a stop that was asked for, 1 for a failure.
export async function supervise({
  programs,
  order,
  logs,
  say,
  environmentOf = (program) => ({ ...process.env, ...program.environment }),
  onStarting = () => {},
  onReady = () => {},
  graceMs = 3000,
  readyWithinMs = 180_000,
  pollMs = 100,
  signals = process,
  lastLines = 15,
}) {
  mkdirSync(logs, { recursive: true });
  const t0 = Date.now();
  const journal = createWriteStream(`${logs}/supervisor.log`, { flags: 'a' });
  const note = (line) => journal.write(`${((Date.now() - t0) / 1000).toFixed(2)} s ${line}\n`);
  const running = new Map();
  const launched = new Map();
  const output = new Map();
  let decided = null;
  let decide;
  const outcome = new Promise((resolve) => {
    decide = (what) => {
      if (decided) return;
      decided = what;
      resolve(what);
    };
  });

  // Each program in a process group of its own, so that a stop reaches what it started too, and a Ctrl-C in a
  // terminal reaches the supervisor alone.
  const signal = (child, name) => {
    try {
      process.kill(-child.pid, name);
    } catch {
      try {
        child.kill(name);
      } catch {
        // gone already
      }
    }
  };

  function launch(name) {
    const program = programs[name];
    const log = createWriteStream(`${logs}/${name}.log`, { flags: 'a' });
    output.set(name, '');
    const keep = (chunk) => {
      if (!log.writableEnded) log.write(chunk);
      output.set(name, (output.get(name) + chunk.toString('utf8')).slice(-KEPT));
    };
    const child = spawn(program.command[0], program.command.slice(1), {
      env: environmentOf(program),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.exited = new Promise((resolve) => {
      let done = false;
      const end = (how) => {
        if (done) return;
        done = true;
        running.delete(name);
        note(`${name} ended: ${how.error ? how.error.message : how.signal ?? `status ${how.code}`}`);
        resolve(how);
      };
      // A program has stopped when it has exited, whether or not something it started still holds its output.
      child.on('error', (error) => end({ error }));
      child.on('exit', (code, signalName) => end({ code, signal: signalName }));
    });
    // Its log ends once nothing more can come, which may be after it has exited.
    child.closed = new Promise((resolve) => {
      const done = () => {
        if (!log.writableEnded) log.end();
        resolve();
      };
      child.on('close', done);
      child.on('error', done);
    });
    running.set(name, child);
    launched.set(name, child);
    note(`${name} started, pid ${child.pid}: ${program.command.join(' ')}`);
    child.exited.then((how) => decide({ failed: name, ...how }));
  }

  async function answering(name) {
    const until = Date.now() + readyWithinMs;
    while (!decided) {
      if (await programs[name].ready()) {
        note(`${name} answers`);
        return;
      }
      if (Date.now() > until) {
        decide({ timedOut: name });
        return;
      }
      await pause(pollMs);
    }
  }

  const asked = (name) => {
    if (decided?.requested || decided?.failed || decided?.timedOut) {
      // A second signal while stopping: no more waiting.
      for (const [, child] of running) signal(child, 'SIGKILL');
      return;
    }
    decide({ requested: name });
  };
  const onSigint = () => asked('SIGINT');
  const onSigterm = () => asked('SIGTERM');
  signals.on('SIGINT', onSigint);
  signals.on('SIGTERM', onSigterm);

  (async () => {
    for (const stage of order) {
      if (decided) return;
      onStarting(stage);
      for (const name of stage) launch(name);
      await Promise.all(stage.filter((name) => !programs[name].background).map(answering));
    }
    if (!decided) onReady();
  })().catch((error) => decide({ broke: error }));

  const what = await outcome;
  note(`stopping: ${JSON.stringify(what, (key, value) => (value instanceof Error ? value.message : value))}`);
  const lines = (name) => plain(output.get(name) ?? '').split('\n').filter((line) => line.trim() !== '').slice(-lastLines);
  if (what.failed) {
    const how = what.error ? `it could not be started: ${what.error.message}` : what.signal ? `by the signal ${what.signal}` : `with exit status ${what.code}`;
    say(`${capitalised(programs[what.failed].label)} stopped unexpectedly, ${how}.`);
  } else if (what.timedOut) {
    say(`${capitalised(programs[what.timedOut].label)} did not answer within ${Math.round(readyWithinMs / 1000)} seconds.`);
  } else if (what.broke) {
    say(`The supervisor broke: ${plain(what.broke.message)}`);
  }
  const named = what.failed ?? what.timedOut;
  if (named) {
    // What it wrote last may still be on its way.
    if (what.failed) await Promise.race([launched.get(named).closed, pause(500)]);
    const last = lines(named);
    say(last.length > 0 ? 'The last lines it wrote:' : 'It wrote nothing.');
    for (const line of last) say(`  ${line}`);
  }
  say(what.requested ? 'Stopping ...' : 'Stopping everything ...');

  const children = [...running.values()];
  for (const child of children) signal(child, 'SIGTERM');
  const late = setTimeout(() => {
    for (const [name, child] of running) {
      note(`${name} killed, ${graceMs} ms after SIGTERM`);
      signal(child, 'SIGKILL');
    }
  }, graceMs);
  await Promise.all(children.map((child) => child.exited));
  clearTimeout(late);
  // Whatever a program started that outlived it, in its process group.
  for (const child of launched.values()) {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // nothing left
    }
  }
  note('stopped');
  await new Promise((resolve) => journal.end(resolve));
  signals.off('SIGINT', onSigint);
  signals.off('SIGTERM', onSigterm);
  return what.requested ? 0 : 1;
}
