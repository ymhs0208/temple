import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const asModule = async (path, imports = {}) => {
 let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
 for (const [name, url] of Object.entries(imports)) source = source.replace(JSON.stringify(name), JSON.stringify(url));
 return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
};
const reminderUrl = await asModule('../lib/line-reminder.ts');
const stopsUrl = await asModule('../lib/pilgrimage-data.ts');
const { buildPilgrimageFlex, isPilgrimageCommand } = await import(await asModule('../lib/line-pilgrimage.ts', { './pilgrimage-data': stopsUrl, './line-reminder': reminderUrl }));

test('seven ordered cards each have their own story and navigation destination', () => {
 process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
 const message = buildPilgrimageFlex();
 assert.equal(message.contents.contents.length, 7);
 message.contents.contents.forEach((card, i) => {
  const actions = card.footer.contents.map(button => button.action);
  assert.equal(actions[0].uri, `https://example.com/pilgrimage/story_${i+1}`);
  const map = new URL(actions[1].uri);
  assert.equal(map.hostname, 'www.google.com');
  assert.equal(map.searchParams.get('destination'), card.body.contents[2].text);
  assert.equal(actions[2].uri, 'https://example.com/pilgrimage');
 });
 assert.ok(Buffer.byteLength(JSON.stringify(message.contents)) < 50000);
});

test('LIFF links work when APP_URL is absent', () => {
 delete process.env.NEXT_PUBLIC_APP_URL;
 process.env.NEXT_PUBLIC_LIFF_ID = 'test-liff';
 assert.equal(buildPilgrimageFlex().contents.contents[0].footer.contents[0].action.uri, 'https://liff.line.me/test-liff/pilgrimage/story_1');
});

test('pilgrimage commands are recognized without intercepting study questions', () => {
 for (const command of ['七媽巡禮', '七個關卡在哪裡', '七關', '宮廟', '關卡地點']) assert.equal(isPilgrimageCommand(command), true);
 for (const command of ['今天讀什麼', '完成英文', '我只有15分鐘']) assert.equal(isPilgrimageCommand(command), false);
});
