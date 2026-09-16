# LINE 學習通知

本次加入每日提醒、晚間未完成提醒與週日回顧的 Flex 卡片。

## 上線前

1. 在已套用 notification-preferences.sql 與 automatic-line-reminders.sql 的資料庫，套用 supabase/flex-notifications.sql。這次程式修改未執行正式資料庫遷移。
2. 設定 LINE_MESSAGING_ACCESS_TOKEN，以及 HTTPS 的 NEXT_PUBLIC_APP_URL 或 NEXT_PUBLIC_LIFF_ID。localhost 不能作為 LINE 通知的正式入口。
3. 確認既有 line-reminders-every-minute 排程所呼叫的網址是目前部署站台；不要再建立第二個相同排程。
4. 部署後由測試帳號登入、加入官方帳號好友、同步學習計畫，再自行點選測試通知。此開發過程未發送真實通知。

## 發送規則

- 個別開關與總開關儲存在 user_preferences；既有帳號的每週回顧預設關閉。
- 每日提醒使用 morning_time；晚間提醒與週日回顧共用 evening_time，兩個時間不能相同。
- 晚間無待辦不推播。週日有週紀錄且開啟回顧時，使用晚間時段發回顧，不額外發晚間提醒。
- 以現有唯一鍵 user_id + reminder_kind + scheduled_for 防止並行重複發送；週回顧使用 evening 時段，三類排程合計每天最多兩則。
- 手動測試、手動週報與原有完成恭喜通知不屬於上述排程上限。
- 週資料限定最近七個日期，包含週末當日，不包含未来任務。分鐘是已完成任務的排定分鐘，不宣稱是量測的專注時間；不捏造正確率。
- 卡片按鈕僅導向網站，不直接完成任務或開始計時。
- 現有排程的同分鐘比對若遇停機可能漏送；沒有補發佇列。推送失敗需查伺服器與 LINE 紀錄，不代表學生已讀。

## 檢查

執行 node --experimental-strip-types --test tests/line-flex.test.mjs 與專案 build。
卡片預覽是標示清楚的示意資料；正式 LINE 渲染仍需於手機測試帳號驗收。
