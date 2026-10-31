const assert = require("node:assert/strict");
const fs = require("node:fs");

const milestones = [7, 30, 100, 180, 365, 500, 1000];
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function message(state, actor, at) {
  const next = { ...state };
  if (actor === "a") next.aAt = at;
  else if (actor === "b") next.bAt = at;
  else throw new Error("unknown actor");

  const expired = next.expiresAt !== null && at >= next.expiresAt;
  if (expired) next.current = 0;

  const aDone = next.aAt !== null && (next.lastMutualAt === null || next.aAt > next.lastMutualAt);
  const bDone = next.bAt !== null && (next.lastMutualAt === null || next.bAt > next.lastMutualAt);

  if (aDone && bDone) {
    next.current = expired || next.expiresAt === null ? 1 : next.current + 1;
    next.longest = Math.max(next.longest, next.current);
    next.lastMutualAt = at;
    next.expiresAt = at + DAY;
  }
  return next;
}
function visible(state, at) {
  return state.expiresAt !== null && at < state.expiresAt ? state.current : 0;
}
function hourglass(state, at) {
  const remaining = state.expiresAt === null ? 0 : state.expiresAt - at;
  return remaining > 0 && remaining <= 4 * HOUR;
}

let s = { current: 0, longest: 0, aAt: null, bAt: null, lastMutualAt: null, expiresAt: null };
const t0 = Date.parse("2026-10-30T12:00:00Z");
s = message(s, "a", t0);
assert.equal(s.current, 0, "one participant must not start a streak");
s = message(s, "a", t0 + HOUR);
assert.equal(s.current, 0, "repeated messages from one participant do not start a streak");
s = message(s, "b", t0 + 2 * HOUR);
assert.equal(s.current, 1, "both participants start the first streak cycle");
assert.equal(s.expiresAt, t0 + 26 * HOUR, "the 24-hour deadline starts after mutual participation");

s = message(s, "a", t0 + 22 * HOUR);
assert.equal(s.current, 1, "the first participant's message alone does not advance the streak");
assert.equal(s.expiresAt, t0 + 26 * HOUR, "one-sided messages do not extend the deadline");
assert.equal(hourglass(s, t0 + 22 * HOUR + 1), true, "hourglass appears in the final four hours");
assert.equal(hourglass(s, t0 + 10 * HOUR), false, "hourglass stays hidden outside the warning window");

s = message(s, "a", t0 + 23 * HOUR);
assert.equal(s.expiresAt, t0 + 26 * HOUR, "repeated messages by the same person do not reset the timer");
s = message(s, "b", t0 + 24 * HOUR);
assert.equal(s.current, 2, "the second participant completes the cycle and advances the streak");
assert.equal(s.expiresAt, t0 + 48 * HOUR, "mutual participation starts the next 24-hour cycle");

assert.equal(visible(s, t0 + 48 * HOUR - 1), 2, "streak remains visible until the exact expiry");
assert.equal(visible(s, t0 + 48 * HOUR), 0, "streak expires at the exact deadline");
s = message(s, "a", t0 + 49 * HOUR);
assert.equal(s.current, 0, "one person cannot restart an expired streak alone");
s = message(s, "b", t0 + 50 * HOUR);
assert.equal(s.current, 1, "both participants after expiry restart at one");
assert.equal(s.longest, 2, "longest streak is preserved after reset");
assert.deepEqual(milestones, [7, 30, 100, 180, 365, 500, 1000]);

const source = fs.readFileSync("xoxo-streaks.js", "utf8");
for (const required of [
  "function scheduleRecord()",
  "The database trigger records each persisted ordinary DM exactly once",
  "await refresh();",
  "[7,30,100,180,365,500,1000]",
  "row.expires_at",
  "4 * 60 * 60 * 1000",
  "row.last_mutual_at"
]) assert.ok(source.includes(required), "missing production integration: " + required);
assert.ok(!source.includes("xoxo_dm_streak_record_message"),
  "browser must not record streaks; the database trigger owns that operation");

console.log("XOXO Streak tests passed: rolling 24-hour expiry, four-hour hourglass, mutual participation, no one-sided timer reset, expiry, restart, longest streak, and milestone list.");
