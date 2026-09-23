import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl = async (path, imports = {}) => {
 let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
 for (const [name, url] of Object.entries(imports)) source = source.replace(JSON.stringify(name), JSON.stringify(url));
 return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
};
const imports = Object.fromEntries(await Promise.all(['pilgrimage-data', 'line-reminder', 'taipei-date'].map(async name => [`./${name}`, await moduleUrl(`../lib/${name}.ts`)])));
const { studyAchievement, buildStampFlex, buildStudyAchievementFlex } = await import(await moduleUrl('../lib/line-achievements.ts', imports));
process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
const now = new Date('2026-09-24T04:00:00Z');
test('Taipei midnight, duplicates, future dates and yesterday grace', () => {
 const result = studyAchievement(['2026-09-21T16:00:00Z', '2026-09-22T18:00:00Z', '2026-09-23T02:00:00Z', '2026-09-25T00:00:00Z', 'invalid'], now);
 assert.equal(result.current, 2);
 assert.equal(result.activeDays, 2);
 assert.equal(result.todayDone, false);
 assert.equal(studyAchievement(['2026-09-23T16:00:00Z'], now).todayDone, true);
});
test('earned badges survive a broken streak and empty history is honest', () => {
 const dates = Array.from({ length: 30 }, (_, index) => new Date(Date.UTC(2026, 7, index + 1)).toISOString());
 const result = studyAchievement(dates, now);
 assert.equal(result.current, 0);
 assert.equal(result.longest, 30);
 assert.deepEqual(result.unlocked, [3, 7, 30]);
 assert.deepEqual(studyAchievement([], now).unlocked, []);
});
test('stamp card counts known distinct codes only and handles completion', () => {
 const partial = buildStampFlex(['QR01', 'QR01', 'INVALID']);
 assert.match(partial.altText, /1\/7/);
 assert.match(JSON.stringify(partial), /下一枚祝福｜旱溪媽/);
 const full = buildStampFlex(Array.from({ length: 7 }, (_, i) => `QR0${i+1}`));
 assert.match(full.altText, /7\/7/);
 assert.match(JSON.stringify(full), /巡禮圓滿/);
 assert.doesNotMatch(JSON.stringify(full), /下一枚祝福/);
});
test('both cards fit Flex limits and all navigation uses HTTPS', () => {
 for (const message of [buildStampFlex([]), buildStudyAchievementFlex([], now)]) {
  assert.ok(Buffer.byteLength(JSON.stringify(message.contents)) < 30000);
  assert.ok(message.altText.length < 400);
  assert.equal(message.quickReply.items.length, 3);
  assert.match(message.contents.footer.contents[0].action.uri, /^https:\/\//);
 }
});
