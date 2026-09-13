export type PilgrimageStop = {
	id: string;
	name: string;
	district: string;
	badge: string;
	story: string;
	insight: string;
	color: string;
	address: string;
	openHours: string;
	coordinates: { lat: number; lng: number };
	highlight: string;
	visitTip: string;
};

export const pilgrimageStops: PilgrimageStop[] = [
	{ id: "story_1", name: "台中媽・萬春宮", district: "臺中州", badge: "萬", story: "萬春宮身為 1917 年七媽會的主辦方之一，見證了這場百年難得一見的宗教盛事。", insight: "歷史碎片 1/7：萬春宮的香火延續至今。", color: "rose", address: "臺中市中區成功路 212 號", openHours: "建議參拜 06:00–22:00", coordinates: { lat: 24.1455, lng: 120.6859 }, highlight: "從台中城的香火出發，展開七媽會的百年巡禮。", visitTip: "在廟埕停下腳步，觀察屋脊剪黏與牌樓細節，再尋找第一枚碎片碼。" },
	{ id: "story_2", name: "旱溪媽・樂成宮", district: "臺中州", badge: "樂", story: "旱溪媽祖以慈悲庇佑地方，當年也一同駐駕於台中市區，賜福黎民。", insight: "歷史碎片 2/7：收集到旱溪媽的祝福。", color: "vermilion", address: "臺中市東區旱溪街 48 號", openHours: "建議參拜 04:00–22:00", coordinates: { lat: 24.1366, lng: 120.7057 }, highlight: "旱溪的信仰記憶，在遶境與日常香火中持續流動。", visitTip: "完成掃碼後，留意廟宇建築與街區之間的歷史連結。" },
	{ id: "story_3", name: "新港媽・奉天宮", district: "嘉義廳", badge: "奉", story: "搭乘火車遠道而來的新港媽，為當年的台中帶來了無比的熱鬧與安定。", insight: "歷史碎片 3/7：感受鐵道與信仰的結合。", color: "gold", address: "嘉義縣新港鄉新民路 53 號", openHours: "建議參拜 04:00–23:00", coordinates: { lat: 23.5542, lng: 120.3477 }, highlight: "一段跨縣市的進香路，讓鐵道與信仰在 1917 年相遇。", visitTip: "想像當年信眾隨火車而來的盛況，完成第三塊碎片的收集。" },
	{ id: "story_4", name: "北港媽・朝天宮", district: "嘉義廳", badge: "朝", story: "北港朝天宮的香火鼎盛，當年參與七媽會更是轟動全台。", insight: "歷史碎片 4/7：重溫百年前的萬人空巷。", color: "jade", address: "雲林縣北港鎮中山路 178 號", openHours: "建議參拜 04:00–23:00", coordinates: { lat: 23.568, lng: 120.305 }, highlight: "北港的鼎盛香火，為七媽會匯聚出萬人同心的熱鬧。", visitTip: "掃碼後回看故事卡，想想一場盛會如何連結不同地方的信眾。" },
	{ id: "story_5", name: "南瑤媽・南瑤宮", district: "臺中州", badge: "南", story: "彰化南瑤宮媽祖也是七媽會的重要貴賓，共同守護中部子民。", insight: "歷史碎片 5/7：信仰跨越了縣市的界線。", color: "violet", address: "彰化縣彰化市南瑤路 43 號", openHours: "建議參拜 04:00–22:00", coordinates: { lat: 24.0691, lng: 120.5364 }, highlight: "一尊媽祖、一段道路，串起彰化與台中的共同記憶。", visitTip: "完成這一站時，為想守護的人留下一句祝福。" },
	{ id: "story_6", name: "鹿港媽・天后宮", district: "臺中州", badge: "天", story: "鹿港天后宮歷史悠久，當年其陣頭與儀仗為七媽會增添了無數光彩。", insight: "歷史碎片 6/7：傳統陣頭的百年記憶。", color: "blue", address: "彰化縣鹿港鎮中山路 430 號", openHours: "建議參拜 05:00–22:00", coordinates: { lat: 24.0566, lng: 120.4315 }, highlight: "古鎮的儀仗與陣頭，讓這場聚會有了聲音與色彩。", visitTip: "仔細看看傳統工藝與儀式細節，為最後一站累積線索。" },
	{ id: "story_7", name: "梧棲媽・朝元宮", district: "臺中州", badge: "元", story: "海線的梧棲媽祖也受邀來到山線，促成了山海媽祖齊聚一堂的佳話。", insight: "歷史碎片 7/7：山海會聚的奇蹟。", color: "cyan", address: "臺中市梧棲區梧棲路 140 號", openHours: "建議參拜 05:00–22:00", coordinates: { lat: 24.2536, lng: 120.5304 }, highlight: "從海線到山城，七媽齊聚，完成一段難得的信仰記憶。", visitTip: "掃描最後一塊碎片後，回到主頁完成歷史問答，開啟隱藏故事。" },
];

export const pilgrimageCodes = pilgrimageStops.map((_, index) => `QR${String(index + 1).padStart(2, "0")}`);
