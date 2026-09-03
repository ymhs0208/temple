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
	{
		id: "story_1",
		name: "台中媽・萬春宮",
		district: "臺中州",
		badge: "萬",
		story: "舊名藍興宮，是位於臺中市中區光復里的媽祖廟，主祀媽祖被尊稱為「台中媽」或「藍興媽祖」。 1917年，萬春宮與台中樂成宮主辦名為「五媽會」的遶境祭祀活動，慶祝台中車站落成。當時集結了其他五座媽祖廟合辦祭典，聯合駐駕長達四十天，因參與的七間廟宇皆為主祀媽祖，故被稱為「七媽會」。",
		insight: "歷史碎片 1/7：萬春宮的香火延續至今。",
		color: "rose",
		address: "臺中市中區成功路 212 號",
		openHours: "建議參拜 06:00–22:00",
		coordinates: { lat: 24.1455, lng: 120.6859 },
		highlight: "從台中城的香火出發，展開七媽會的百年巡禮。",
		visitTip:
			"在廟埕停下腳步，觀察屋脊剪黏與牌樓細節，再尋找第一枚碎片碼。",
	},
	{
		id: "story_2",
		name: "旱溪媽・樂成宮",
		district: "臺中州",
		badge: "樂",
		story: "位於臺中市東區旱溪的媽祖廟，主祀之媽祖被稱為「旱溪媽祖」。相傳於清高宗乾隆十八年（1753年）由庄民建廟奉祀。其建築與文物分別被列為臺中市的市定古蹟與古物，而著名的「旱溪媽祖遶境十八庄」活動也被列為市定民俗。",
		insight: "歷史碎片 2/7：收集到旱溪媽的祝福。",
		color: "vermilion",
		address: "臺中市東區旱溪街 48 號",
		openHours: "建議參拜 04:00–22:00",
		coordinates: { lat: 24.1366, lng: 120.7057 },
		highlight: "旱溪的信仰記憶，在遶境與日常香火中持續流動。",
		visitTip: "完成掃碼後，留意廟宇建築與街區之間的歷史連結。",
	},
	{
		id: "story_3",
		name: "新港媽・奉天宮",
		district: "嘉義廳",
		badge: "奉",
		story: "位於嘉義縣新港鄉，主祀天上聖母，是臺灣著名的媽祖廟之一。在歷經地震毀損後，於1917年（大正6年）完成修建，目前被列為第三級古蹟。廟方每年農曆正月十五日會舉行上元遶境活動，且這裡也是大甲媽祖遶境進香活動的終點站。",
		insight: "歷史碎片 3/7：感受鐵道與信仰的結合。",
		color: "gold",
		address: "嘉義縣新港鄉新民路 53 號",
		openHours: "建議參拜 04:00–23:00",
		coordinates: { lat: 23.5542, lng: 120.3477 },
		highlight: "一段跨縣市的進香路，讓鐵道與信仰在 1917 年相遇。",
		visitTip: "想像當年信眾隨火車而來的盛況，完成第三塊碎片的收集。",
	},
	{
		id: "story_4",
		name: "北港媽・朝天宮",
		district: "嘉義廳",
		badge: "朝",
		story: "舊稱天后宮，當地人俗稱「媽祖宮」或「媽祖廟」，位於雲林縣北港鎮，有「台灣媽祖總本山」之稱。於康熙三十三年（1694年）由臨濟宗樹璧和尚創立。建築群極具歷史與藝術價值，曾被比擬為臺灣的日光東照宮，現為中華民國國定古蹟。",
		insight: "歷史碎片 4/7：重溫百年前的萬人空巷。",
		color: "jade",
		address: "雲林縣北港鎮中山路 178 號",
		openHours: "建議參拜 04:00–23:00",
		coordinates: { lat: 23.568, lng: 120.305 },
		highlight: "北港的鼎盛香火，為七媽會匯聚出萬人同心的熱鬧。",
		visitTip: "掃碼後回看故事卡，想想一場盛會如何連結不同地方的信眾。",
	},
	{
		id: "story_5",
		name: "南瑤媽・南瑤宮",
		district: "臺中州",
		badge: "南",
		story: "位於彰化縣彰化市南瑤里，俗稱「彰化媽」或「南門媽」，因早年位於彰化縣城南門外而得名。彰化南瑤宮媽祖也是七媽會的重要貴賓，共同守護中部子民。約在清朝乾隆年間建立，分靈自古笨港天后宮。香火鼎盛，屢稱靈驗，有「彰化媽蔭外方」之名，並擁有自清嘉慶年間發展而來的「十媽會」等龐大信徒組織。",
		insight: "歷史碎片 5/7：信仰跨越了縣市的界線。",
		color: "violet",
		address: "彰化縣彰化市南瑤路 43 號",
		openHours: "建議參拜 04:00–22:00",
		coordinates: { lat: 24.0691, lng: 120.5364 },
		highlight: "一尊媽祖、一段道路，串起彰化與台中的共同記憶。",
		visitTip: "完成這一站時，為想守護的人留下一句祝福。",
	},
	{
		id: "story_6",
		name: "鹿港媽・天后宮",
		district: "臺中州",
		badge: "天",
		story: "前身為鹿港天妃廟，位於彰化縣鹿港鎮，是臺灣歷史最悠久的知名廟宇之一。鹿港天后宮歷史悠久，當年其陣頭與儀仗為七媽會增添了無數光彩。創建於明末清初，是臺灣最早且唯一奉祀湄洲天后宮天上聖母開基神尊的廟宇。建築歷經多次重修，目前由中華民國文化部評定為國定古蹟。",
		insight: "歷史碎片 6/7：傳統陣頭的百年記憶。",
		color: "blue",
		address: "彰化縣鹿港鎮中山路 430 號",
		openHours: "建議參拜 05:00–22:00",
		coordinates: { lat: 24.0566, lng: 120.4315 },
		highlight: "古鎮的儀仗與陣頭，讓這場聚會有了聲音與色彩。",
		visitTip: "仔細看看傳統工藝與儀式細節，為最後一站累積線索。",
	},
	{
		id: "story_7",
		name: "梧棲媽・朝元宮",
		district: "臺中州",
		badge: "元",
		story: "位於臺中市梧棲區中和里的媽祖廟，信眾稱其媽祖為「梧棲媽」。海線的梧棲媽祖也受邀來到山線，促成了山海媽祖齊聚一堂的佳話。於清咸豐六年（1856年）由米商倡建，曾是當時閩南商戶祭祀與集會之處。廟方在重要節慶時會舉行抬轎衝刺的「梧棲走大轎」宗教活動，此儀式已被登錄為臺中市民俗類文化資產。",
		insight: "歷史碎片 7/7：山海會聚的奇蹟。",
		color: "cyan",
		address: "臺中市梧棲區梧棲路 140 號",
		openHours: "建議參拜 05:00–22:00",
		coordinates: { lat: 24.2536, lng: 120.5304 },
		highlight: "從海線到山城，七媽齊聚，完成一段難得的信仰記憶。",
		visitTip: "掃描最後一塊碎片後，回到主頁完成歷史問答，開啟隱藏故事。",
	},
];

export const pilgrimageCodes = pilgrimageStops.map(
	(_, index) => `QR${String(index + 1).padStart(2, "0")}`,
);
