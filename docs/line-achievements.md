# LINE 巡禮集章與學習成就

在官方帳號一對一聊天室傳「巡禮集章卡」或「連續學習成就」。巡禮導覽、任務完成與進度卡也提供快捷入口。指令在學習計畫與對話狀態判斷之前處理，巡禮使用者無須先建立讀書計畫。

- 巡禮卡只計算 temple_visits 中 QR01–QR07 的已同步紀錄，去除重複與未知代碼。七站集满後引導回原巡禮問答／證書流程，不自動宣稱已取得證書。
- 學習卡依該帳號所有 task_completions.completed_at 換算台灣日期，同日完成多項只計一天。今天未完成時，連續天數可延續至昨天；昨天亦無紀錄則歸零。
- 3／7／30 天徽章依現存歷史紀錄的最長連續天數計算，連續中斷不會使已達成徽章變回未達成。刪除歷史資料亦會影響結果；未新增永久徽章資料表。
- 查詢分頁載入，避免 Supabase 單次回傳限制截斷歷史。無帳號引導登入，無紀錄顯示零，資料查詢失敗顯示重試訊息；不把失敗當零。
- 僅回覆主動查詢，不新增排程或額外主動推播。卡片可使用 LINE 原有的轉傳操作分享，無公開個人資料連結。

## 從 LINE 新增今日任務

傳「新增英文 30 分鐘」或先傳「新增任務」再選範例。LINE 會先回傳確認卡；只有按下「確認新增」才會將任務加到當天清單最後一項。科目最多 40 字，時間限制為 1–180 分鐘。此功能需要帳號已有學習計畫，新增任務不會覆蓋既有任務。

提醒卡的「延後 30 分鐘」會在延後時間重新送出同類提醒；「今天暫停」會跳過當日後續提醒，隔天自動恢復。兩個狀態儲存在 `user_preferences`，需要套用 `supabase/notification-preferences.sql` 的欄位遷移。

## 同步資料保護

同步已改為合併今天的任務，保留 LINE 或其他裝置新增的資料，不再整批刪除今天任務。正式環境請先執行 `supabase/safe-sync-learning-progress.sql` 更新既有的 `sync_learning_progress` RPC；只更新程式碼而未執行這個遷移時，舊 RPC 仍會整批重建任務。

## 驗證

`node --test tests/line-achievements.test.mjs tests/line-pilgrimage.test.mjs tests/line-flex.test.mjs`

`npm run build`

`outputs/line-achievements-preview.html` 是依卡片結構產生的示意預覽，包含四種狀態，並非 LINE 原生渲染。部署後以 LINE 手機驗收字級、換行、按鈕跳轉與各自帳號的真實紀錄。本次未部署、未傳送真實訊息，沿用既有 users、temple_visits、task_completions，無新增資料庫遷移。
