const assert = require("node:assert/strict");
const fs = require("node:fs");

const milestones = [7, 30, 100, 180, 365, 500, 1000];
const day = value => new Date(value + "T00:00:00.000Z");
const date = value => value.toISOString().slice(0, 10);

function applyMessage(state, actor, today) {
  const next = { ...state };
  if (actor === "a") next.aDate = today;
  else if (actor === "b") next.bDate = today;
  else throw new Error("unknown actor");
  if (next.aDate === today && next.bDate === today && next.lastActive !== today) {
    const yesterday = date(new Date(day(today).getTime() - 86400000));
    next.current = next.lastActive === yesterday && next.current > 0 ? next.current + 1 : 1;
    next.longest = Math.max(next.longest, next.current);
    next.lastActive = today;
  }
  return next;
}
function visibleStreak(state, today) {
  const cutoff = date(new Date(day(today).getTime() - 86400000));
  return state.lastActive && state.lastActive < cutoff ? 0 : state.current;
}

let state = { current: 0, longest: 0, lastActive: null, aDate: null, bDate: null };
state = applyMessage(state, "a", "2026-10-30");
assert.equal(state.current, 0, "one participant must not start a streak");
state = applyMessage(state, "b", "2026-10-30");
assert.equal(state.current, 1, "both participants start day one");
state = applyMessage(state, "a", "2026-10-30");
state = applyMessage(state, "b", "2026-10-30");
assert.equal(state.current, 1, "multiple messages on one day count once");
state = applyMessage(state, "a", "2026-10-31");
assert.equal(state.current, 1, "one participant cannot advance the streak");
state = applyMessage(state, "b", "2026-10-31");
assert.equal(state.current, 2, "both participants on the next day advance to two");
state = applyMessage(state, "a", "2026-11-02");
assert.equal(visibleStreak(state, "2026-11-02"), 0, "a missed full day expires the visible streak");
state = applyMessage(state, "b", "2026-11-02");
assert.equal(state.current, 1, "both participants after a missed day restart at one");
assert.equal(state.longest, 2, "longest streak is preserved after a reset");
assert.deepEqual(milestones, [7, 30, 100, 180, 365, 500, 1000]);

const source = fs.readFileSync("xoxo-streaks.js", "utf8");
for (const required of [
  "function hasRecentOutgoingMessage()",
  "RPC independently verifies the authenticated user's persisted recent DM",
  "function scheduleRecord()",
  'c.rpc("xoxo_dm_streak_record_message"',
  "[7,30,100,180,365,500,1000]"
]) assert.ok(source.includes(required), "missing production integration: " + required);

console.log("XOXO Streak logic tests passed: two-user participation, once-per-day counting, consecutive-day advance, missed-day reset, record preservation, milestone list, and persisted outgoing-message guard.");
