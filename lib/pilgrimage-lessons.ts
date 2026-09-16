export type LessonQuestion = { question: string; choices: string[]; answer: number; explanation: string };
export type PilgrimageLesson = { title: string; takeaway: string; questions: LessonQuestion[] };
// Reading-comprehension questions based on the site's existing story text.
// These do not introduce additional historical claims.
export const pilgrimageLessons: PilgrimageLesson[] = [
  { title: "城市記憶發現者", takeaway: "萬春宮的舊名、地方稱呼與七媽會，都是理解臺中信仰記憶的線索。", questions: [
    { question: "依照這一站的故事，萬春宮的舊名是什麼？", choices: ["朝元宮", "藍興宮", "天妃廟"], answer: 1, explanation: "故事提到萬春宮舊名「藍興宮」，主祀媽祖也被稱為台中媽或藍興媽祖。廟名與神明稱呼，能留下地方的記憶。" },
    { question: "故事中的「七媽會」，名稱與什麼有關？", choices: ["七間主祀媽祖的廟宇參與", "活動只有七天", "只有七位信眾參加"], answer: 0, explanation: "依本頁故事，七間主祀媽祖的廟宇共同參與，所以稱為七媽會；名稱不是指活動天數或信眾人數。" },
  ] },
  { title: "地方信仰探索者", takeaway: "文化資產不只是一棟建築，也可以是持續被人們實踐的民俗。", questions: [
    { question: "樂成宮主祀的媽祖，在故事中被稱為什麼？", choices: ["新港媽", "梧棲媽", "旱溪媽祖"], answer: 2, explanation: "本頁以「旱溪媽祖」介紹樂成宮。地方稱呼能幫助我們把廟宇與所在街區連在一起。" },
    { question: "「旱溪媽祖遶境十八庄」屬於哪一種故事線索？", choices: ["只是一件可以展示的器物", "地方持續參與的民俗活動", "一座鐵路車站"], answer: 1, explanation: "故事介紹的是遶境活動。認識文化時，除了看建築與文物，也要理解人們如何參與、傳承活動。" },
  ] },
  { title: "信仰旅途觀察者", takeaway: "廟宇故事既包含建築的修建，也包含人們年復一年走過的路。", questions: [
    { question: "奉天宮位於哪裡？", choices: ["嘉義縣新港鄉", "彰化縣鹿港鎮", "臺中市梧棲區"], answer: 0, explanation: "故事開頭介紹奉天宮位於嘉義縣新港鄉。閱讀地名能建立各站之間的空間關係。" },
    { question: "依本頁故事，奉天宮與哪項進香活動有關？", choices: ["梧棲走大轎", "大甲媽祖遶境進香", "旱溪媽祖遶境十八庄"], answer: 1, explanation: "本頁指出奉天宮是大甲媽祖遶境進香活動的終點站。不同廟宇可以透過進香路線彼此連結。" },
  ] },
  { title: "建築故事收藏者", takeaway: "同一座廟可能有正式名稱、舊名與地方慣用的稱呼。", questions: [
    { question: "本頁故事中的北港朝天宮，位於哪個縣市？", choices: ["臺中市", "嘉義縣", "雲林縣"], answer: 2, explanation: "朝天宮位於雲林縣北港鎮。別把名稱相近、路程相近的站點混在一起。" },
    { question: "故事提到當地人會如何稱呼朝天宮？", choices: ["媽祖宮或媽祖廟", "台中車站", "藍興宮"], answer: 0, explanation: "故事列出媽祖宮、媽祖廟等地方稱呼。這些稱呼呈現廟宇如何融入日常生活。" },
  ] },
  { title: "南門記憶解讀者", takeaway: "「南門媽」不只是稱號，也是一條記錄城市空間的線索。", questions: [
    { question: "依本頁故事，南瑤宮為何有「南門媽」的稱呼？", choices: ["只有南方的人可以參拜", "早年位於彰化縣城南門外", "每次活動都從南門結束"], answer: 1, explanation: "故事說明南瑤宮早年位於彰化縣城南門外，因此有南門媽的稱呼。地名與稱號有時能幫助我們讀懂舊城的位置。" },
    { question: "故事提到的「十媽會」，可以幫助我們理解什麼？", choices: ["只有十件建築裝飾", "十座鐵路月台", "地方信徒組織的發展"], answer: 2, explanation: "本頁把十媽會放在信徒組織的脈絡中介紹。廟宇文化除了建築，也包括人們如何組織與延續信仰。" },
  ] },
  { title: "古鎮文化尋跡者", takeaway: "從名稱、所在地與建築細節，可以逐步認識一座廟的歷史。", questions: [
    { question: "鹿港天后宮位於哪個地方？", choices: ["彰化縣鹿港鎮", "雲林縣北港鎮", "嘉義縣新港鄉"], answer: 0, explanation: "本頁介紹的是彰化縣鹿港鎮的天后宮；鹿港、北港與新港是不同站點。" },
    { question: "本頁提到鹿港天后宮的前身名稱是什麼？", choices: ["藍興宮", "鹿港天妃廟", "樂成宮"], answer: 1, explanation: "故事以「鹿港天妃廟」作為前身名稱。比較前身與現在名稱，是閱讀廟宇故事的一種方法。" },
  ] },
  { title: "山海巡禮記錄者", takeaway: "宗教活動與商業、聚會等地方生活，可能交織在同一座廟的故事裡。", questions: [
    { question: "本頁朝元宮故事中的媽祖，被稱為什麼？", choices: ["旱溪媽", "彰化媽", "梧棲媽"], answer: 2, explanation: "朝元宮位於臺中市梧棲區，信眾稱其媽祖為梧棲媽。這是海線站點的地方稱呼。" },
    { question: "依本頁故事，朝元宮曾是閩南商戶的什麼場所？", choices: ["祭祀與集會之處", "鐵路售票處", "只存放貨物的倉庫"], answer: 0, explanation: "故事提到祭祀與集會。這提醒我們，廟宇除了宗教意義，也可能承載地方社群的生活。" },
  ] },
  { title: "守信行動實踐者", takeaway: "南天宮的城市地標與關帝信仰，提供一個思考忠義、守信與日常行動的入口。", questions: [
    { question: "台中南天宮主祀哪位神明？", choices: ["關帝聖君", "天上聖母", "文昌帝君"], answer: 0, explanation: "南天宮官方介紹以關帝聖君為主祀神明；這一站從忠義與守信的文化意義出發。" },
    { question: "南天宮的哪項特色成為臺中東區的城市地標？", choices: ["高達一百四十六尺的聖帝大神像", "七天不間斷的遶境", "古老的鐵路月台"], answer: 0, explanation: "官方資料提到南天宮完成高達一百四十六尺的聖帝大神像，成為醒目的地標。" },
  ] },
];
