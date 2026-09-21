import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const personal = {
  daysLeft: 12, weakSubject: '英文', dailyHours: 1, goal: '完成英文閱讀',
  tasks: [{ subject: '英文', minutes: 20, detail: '閱讀錯題', done: false }],
  weakQuestionCount: 3, dueWeakQuestionCount: 2,
  weekly: { rate: 40, minutes: 80, subjects: ['英文 · 完成 2/5 項'] },
};
const mock = `export async function coachUserData(token) {
 if (token === 'invalid') throw new Error('invalid identity');
 if (token === 'empty') return null;
 return ${JSON.stringify(personal)};
}`;
const mockUrl = `data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`;
const source = await readFile(new URL('../app/api/coach/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('"@/lib/coach-user-data"', JSON.stringify(mockUrl));
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const send = (body) => POST(new Request('http://localhost/api/coach', { method: 'POST', body: JSON.stringify(body) }));
delete process.env.GEMINI_API_KEY;

test('authenticated advice uses server profile instead of forged client progress', async () => {
 const response = await send({ idToken: 'valid', context: { weakSubject: '偽造科目', tasks: [], availableMinutes: 30 } });
 const data = await response.json();
 assert.equal(response.status, 200);
 assert.match(data.answer, /英文/);
 assert.match(data.answer, /40%/);
 assert.match(data.answer, /一道題/);
 assert.doesNotMatch(data.answer, /偽造科目/);
 assert.equal([...data.answer.matchAll(/^\d\. (\d+) 分鐘/gm)].reduce((sum, match) => sum + Number(match[1]), 0), 30);
});

test('invalid identity never falls back to client data', async () => {
 const response = await send({ idToken: 'invalid', context: { weakSubject: '數學' } });
 assert.equal(response.status, 503);
 assert.equal((await response.json()).answer, undefined);
});

test('account without a plan receives an actionable empty state', async () => {
 assert.equal((await send({ idToken: 'empty' })).status, 409);
});

test('missing guest data does not invent an exam countdown or weak questions', async () => {
 const response = await send({ context: { daysLeft: null, weakQuestionCount: null, dueWeakQuestionCount: null } });
 const data = await response.json();
 assert.match(data.answer, /尚未設定考試日期/);
 assert.match(data.answer, /尚無可用的錯題資料/);
 assert.match(data.answer, /尚無足夠紀錄/);
 assert.doesNotMatch(data.answer, /距離目標 0 天/);
});

test('profile loader scopes every database lookup to the verified identity and today', async () => {
 const calls = [];
 globalThis.__coachTestCalls = calls;
 const tables = {
  users: { id: 'verified-user' },
  study_plans: { id: 'owned-plan', exam_date: '2026-10-01', daily_hours: 2, weak_subject: '數學', goal: '複習' },
  daily_tasks: [{ id: 'owned-task', subject: '數學', minutes: 20, task_type: '錯題' }],
  user_companion_states: { daily_fortune_task: { date: '2026-09-22', done: true, weakQuestions: [{ nextReviewDate: '2026-09-21' }, { nextReviewDate: '2026-10-01' }] } },
  task_completions: [{ task_id: 'owned-task' }],
 };
 const dependencies = {
  './line': `export async function verifyLineIdToken(token) { if(token !== 'valid') throw Error('invalid'); return {userId:'verified-line'}; }`,
  './taipei-date': `export function taipeiDate() { return '2026-09-22'; }`,
  './weekly-learning': `export async function weeklyLearning(userId, date) { globalThis.__coachTestCalls.push(['weekly',userId,date]); return null; }`,
  './supabase-admin': `const tables=${JSON.stringify(tables)}; export function supabaseAdmin() { return { from(table) { const query={}; for(const method of ['select','eq','in','order','limit']) query[method]=(...args)=>{globalThis.__coachTestCalls.push([table,method,...args]);return query;}; query.maybeSingle=async()=>({data:tables[table],error:null}); query.then=(resolve,reject)=>Promise.resolve({data:tables[table],error:null}).then(resolve,reject); return query; } }; }`,
 };
 let code = ts.transpileModule(await readFile(new URL('../lib/coach-user-data.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
 for (const [name, body] of Object.entries(dependencies)) code = code.replace(JSON.stringify(name), JSON.stringify(`data:text/javascript;base64,${Buffer.from(body).toString('base64')}`));
 const { coachUserData } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
 const profile = await coachUserData('valid');
 assert.equal(profile.tasks[0].done, true);
 assert.equal(profile.dueWeakQuestionCount, 1);
 assert.equal(profile.daysLeft, 9);
 for (const expected of [
  ['users','eq','line_user_id','verified-line'],
  ['study_plans','eq','user_id','verified-user'],
  ['daily_tasks','eq','plan_id','owned-plan'],
  ['daily_tasks','eq','task_date','2026-09-22'],
  ['task_completions','eq','user_id','verified-user'],
  ['user_companion_states','eq','user_id','verified-user'],
  ['weekly','verified-user','2026-09-22'],
 ]) assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(expected)), JSON.stringify(expected));
 calls.length = 0;
 await assert.rejects(coachUserData('invalid'));
 assert.equal(calls.length, 0);
 delete globalThis.__coachTestCalls;
});
