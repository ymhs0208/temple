import test from "node:test";
import assert from "node:assert/strict";
import { buildTimePlan, parseAvailableMinutes } from "../lib/line-planning.ts";

const tasks = [
  { id: "math", subject: "數學", minutes: 40, task_type: "練習" },
  { id: "english", subject: "英文", minutes: 30, task_type: "複習" },
];

test("parses natural time phrases used in LINE", () => {
  assert.equal(parseAvailableMinutes("我只有45分鐘"), 45);
  assert.equal(parseAvailableMinutes("我有半小時"), 30);
  assert.equal(parseAvailableMinutes("我有一小時"), 60);
  assert.equal(parseAvailableMinutes("只剩兩小時"), 120);
  assert.equal(parseAvailableMinutes("幫我安排"), null);
});

test("plans only unfinished tasks and never falls back to completed work", () => {
  const result = buildTimePlan(tasks, new Set(["math"]), "我只有 30 分鐘");
  assert.deepEqual(result.tasks.map(task => [task.id, task.minutes]), [["english", 30]]);
  assert.deepEqual(buildTimePlan(tasks, new Set(["math", "english"]), "我有 60 分鐘").tasks, []);
});
