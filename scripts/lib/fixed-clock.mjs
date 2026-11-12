// Holds the clock of the process it is loaded into, with `node --import`, at the moment KONZILO_DEMO_MOMENT
// names, so that the core's intake command makes the same content files on any day.
//
// Why: `konzilo-intake` reads the time itself (`now: new Date()` in the core's bin/konzilo-intake.js) and has
// no way to be given one, and what it writes depends on it where nothing else decides: the service registry's
// `revised` day, and the date of any post without one of its own. The core's own test of its demo content
// gives the intake function a fixed moment for the same reason. Remove this file, and its use in
// scripts/lib/intake.mjs, once the intake command takes a moment of its own.
//
// Only a Date made without arguments, and Date.now(), give the moment; a Date made of a value is as it was.

const moment = process.env.KONZILO_DEMO_MOMENT;
const fixed = Date.parse(moment ?? '');
if (Number.isNaN(fixed)) throw new Error(`fixed-clock: KONZILO_DEMO_MOMENT must be a moment, such as 2026-11-12T12:00:00Z, not ${moment}`);

const RealDate = globalThis.Date;
globalThis.Date = new Proxy(RealDate, {
  construct: (target, args, newTarget) => Reflect.construct(target, args.length === 0 ? [fixed] : args, newTarget),
  apply: () => new RealDate(fixed).toString(),
  get: (target, key, receiver) => (key === 'now' ? () => fixed : Reflect.get(target, key, receiver)),
});
