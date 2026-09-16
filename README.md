# 文昌同行｜30 日學習挑戰

以「每天完成一小步」為核心的學習陪伴網站。使用者可建立每日任務、進行專注計時、查看學習紀錄，並透過 LINE 登入同步資料與接收提醒。

正式網站：[score.cc.cd](https://score.cc.cd)

## 主要功能

- 每日學習任務、單項專注計時與批次完成
- 學習行事曆與每日完整紀錄彈窗
- 週完成分鐘數、連續學習天數與學習徽章
- 目標設定、考試倒數與弱科規劃
- LINE LIFF 登入與跨裝置資料同步
- LINE 早晚通知偏好與測試通知
- 祈願、祈福牆與巡禮紀錄
- 支援手機、平板與桌面瀏覽器的響應式版面

## 技術

- React 19、Vinext、Vite
- Cloudflare Workers / Workers Builds
- Supabase（資料庫、排程與 Vault）
- LINE LIFF / Messaging API

## 本機啟動

### 必要條件

- Node.js 22.13 或以上
- Git

```powershell
git clone https://github.com/ymhs0208/temple.git
cd temple
npm install
```

在 Windows 啟動開發站請使用：

```powershell
.\node_modules\.bin\vinext.cmd dev
```

終端會顯示本機網址，例如 `http://localhost:3000`。若該埠已被使用，會自動改用其他埠號。

建立正式版：

```powershell
.\node_modules\.bin\vinext.cmd build
```

> `npm run dev` 與 `npm run build` 適合 macOS / Linux。Windows 請使用上方的 `vinext.cmd` 指令。

## 環境變數

部署環境需設定以下變數，敏感值必須設為 Secret，且不可提交到 Git。

| 變數 | 用途 | 是否敏感 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 專案網址 | 否 |
| `SUPABASE_SERVICE_ROLE_KEY` | 後端資料庫管理權限 | 是 |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login Channel ID | 否 |
| `NEXT_PUBLIC_LIFF_ID` | LINE LIFF ID | 否 |
| `LINE_MESSAGING_ACCESS_TOKEN` | LINE OA 推播權杖 | 是 |
| `LINE_MESSAGING_CHANNEL_SECRET` | LINE Webhook 驗證密鑰 | 是 |

若任何 Access Token、Secret 或 Service Role Key 曾公開，請立即在對應平台撤銷並重新產生。

## Supabase 設定

首次建立資料庫時，依序在 Supabase SQL Editor 執行：

1. [`supabase/schema.sql`](supabase/schema.sql)
2. [`supabase/notification-preferences.sql`](supabase/notification-preferences.sql)
3. [`supabase/prayer-wall.sql`](supabase/prayer-wall.sql)
4. [`supabase/automatic-line-reminders.sql`](supabase/automatic-line-reminders.sql)

通知排程會每分鐘呼叫網站後端，再由後端傳送 LINE 訊息。這可避免部分 `pg_net` 版本直接呼叫 LINE API 時的 JSON 相容性問題。

## 部署

### 正式環境

`main` 是正式分支，對應 [score.cc.cd](https://score.cc.cd)。請只透過 Pull Request 將已測試功能合併到 `main`。

### Cloudflare Preview

Cloudflare Workers Builds 已連接此倉庫。推送非 `main` 分支時，Cloudflare 會自動建立 Preview 版本網址；每個提交都會產生新的版本網址，不會影響正式站。

目前各開發分支的固定測試網址：

- [dev-zhang](https://dev-zhang-temple.ymhs0208.workers.dev/)
- [dev-yoby96321](https://dev-yoby96321-temple.ymhs0208.workers.dev/)
- [dev-Nasa0402](https://dev-nasa0402-temple.ymhs0208.workers.dev/)

## 三人協作流程

| 分支 | 用途 |
| --- | --- |
| `main` | 正式版，對應 `score.cc.cd` |
| `dev-zhang` | zhang 的開發與測試 |
| `dev-yoby96321` | yoby96321 的開發與測試 |
| `dev-Nasa0402` | Nasa0402 的開發與測試 |

開始開發前：

```powershell
git fetch origin
git switch dev-zhang
git merge origin/main
```

完成功能後：

```powershell
git add .
git commit -m "說明這次修改"
git push origin dev-zhang
```

接著在 GitHub 建立 Pull Request：`dev-zhang` → `main`。請避免直接推送或強制推送 `main`。

若多人處理同一功能，請依「畫面與互動 / API 與資料庫 / 測試與驗收」切分，避免同時編輯同一個檔案區塊。

## 專案結構

```text
app/                    前端頁面與 API 路由
app/api/                同步、統計、通知、LINE、祈福牆 API
supabase/               資料表、通知與排程 SQL
public/                 靜態圖片與資源
```

## 安全提醒

- 不要將 `.env`、Access Token、Channel Secret 或 Supabase Service Role Key 推送到 GitHub。
- LINE 推播必須使用已加入官方帳號好友、且未封鎖官方帳號的使用者 ID。
- 正式部署前請確認 Preview 環境沒有使用正式資料的破壞性測試。
