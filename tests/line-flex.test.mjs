import test from "node:test";
import assert from "node:assert/strict";
import { buildReminderFlex, buildWeeklyFlex, learningUrl } from "../lib/line-reminder.ts";

process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
const tasks = [{ subject: "數學", minutes: 25 }, { subject: "英文", minutes: 20 }];
test("daily card uses actual remaining minutes and navigates without completing", () => {
  const card = buildReminderFlex({ kind: "morning", tasks, pending: tasks.slice(1), dayNumber: 13 });
  const json = JSON.stringify(card);
  assert.match(json, /20 分鐘/);
  assert.match(json, /Day 13/);
  assert.doesNotMatch(json, /下降|昨天的紀錄|letterSpacing/);
  const action = card.contents.footer.contents[0].action;
  assert.equal(action.type, "uri");
  assert.equal(action.uri, "https://example.com/today");
});
test("evening card has one clear continue action", () => {
  const card = buildReminderFlex({ kind: "evening", tasks, pending: tasks });
  assert.equal(card.contents.footer.contents.length, 1);
  assert.equal(card.contents.footer.contents[0].action.label, "繼續學習");
});
test("weekly card distinguishes completed task minutes from measured focus", () => {
  const card = buildWeeklyFlex({ minutes: 180, rate: 80, subjects: ["數學 · 完成 4/5 項"], period: "2026-09-07 ～ 2026-09-13" });
  assert.match(JSON.stringify(card), /完成任務累積 180 分鐘/);
  assert.equal(card.contents.footer.contents[0].action.uri, "https://example.com/progress");
});
test("links reject local HTTP and preserve LIFF routing", () => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
  assert.throws(() => learningUrl("/today"), /HTTPS/);
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_LIFF_ID = "test-id";
  assert.equal(learningUrl("/progress"), "https://liff.line.me/test-id/progress");
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
});
