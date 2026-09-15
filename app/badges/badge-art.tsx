const drawings: Record<string, string[]> = {
  flame: ["M32 5C38 20 52 23 49 39A18 18 0 0 1 14 37C13 28 21 19 26 16C23 28 30 29 32 5Z", "M32 32C40 39 40 49 32 53C23 50 24 42 32 32Z"],
  book: ["M6 13Q20 8 32 17Q44 8 58 13V49Q44 44 32 53Q20 44 6 49Z", "M32 17V53M13 22L24 25M13 30L24 33M40 25L51 22M40 33L51 30"],
  hourglass: ["M17 7H47M17 57H47M20 7V18L29 30V34L20 46V57M44 7V18L35 30V34L44 46V57", "M23 17H41L32 28ZM23 51L32 40L41 51Z"],
  compass: ["M32 5A27 27 0 1 0 32 59A27 27 0 1 0 32 5", "M43 20L37 37L20 44L27 27ZM32 9V14M50 32H55M32 50V55M9 32H14"],
  star: ["M32 7L39 23L57 25L43 37L47 55L32 46L17 55L21 37L7 25L25 23Z", "M7 8L11 12M53 10L58 5M29 30L32 25L35 30"],
  crown: ["M8 18L20 29L32 10L44 29L56 18L50 47H14ZM14 54H50", "M21 38H22M32 34H33M42 38H43"],
  flag: ["M16 57V7M16 10Q29 3 40 12Q48 18 56 10V34Q46 42 36 34Q26 25 16 32", "M8 57H25M25 18L30 23L39 16"],
  sprout: ["M32 56V32M32 37Q8 38 9 15Q32 13 32 37ZM32 28Q32 7 55 8Q56 30 32 28Z", "M17 23L32 38M45 17L32 30M18 56H46"],
  sun: ["M32 18A14 14 0 1 0 32 46A14 14 0 1 0 32 18", "M32 3V10M32 54V61M3 32H10M54 32H61M11 11L16 16M48 48L53 53M11 53L16 48M48 16L53 11"],
  moon: ["M42 7A25 25 0 1 0 56 43A24 24 0 0 1 42 7Z", "M49 14V26M43 20H55M29 40L32 43L39 36"],
  wand: ["M11 55L41 25L47 31L17 61ZM40 5L44 13L53 14L47 21L48 30L40 26L32 30L33 21L27 14L36 13Z", "M11 10V20M6 15H16M51 43V55M45 49H57"],
  galaxy: ["M32 20A12 12 0 1 0 32 44A12 12 0 1 0 32 20", "M9 44C-2 34 43 4 55 20C66 35 20 61 9 44ZM14 10L17 13M49 51L52 54"],
  bolt: ["M37 4L10 36H28L24 60L55 25H36Z", "M7 13L12 18M52 47L58 53"],
  map: ["M5 14L23 7L41 15L59 7V50L41 58L23 50L5 58ZM23 7V50M41 15V58", "M12 40L18 33L30 38L46 26M46 22L51 27M51 22L46 27"],
  shield: ["M32 5L54 14V32Q51 50 32 59Q13 50 10 32V14Z", "M20 31L28 39L45 23"],
  repair: ["M48 7L39 16L47 24L56 15Q62 33 43 35L20 58L8 46L31 23Q29 5 48 7Z", "M15 46L20 51M8 8L19 19M12 5L22 15"],
  trophy: ["M19 7H45V25Q45 39 32 39Q19 39 19 25ZM32 39V51M20 57H44M25 51H39", "M19 13H7V21Q7 32 21 32M45 13H57V21Q57 32 43 32"],
  gem: ["M17 8H47L59 26L32 59L5 26ZM5 26H59M17 8L24 26L32 59L40 26L47 8M24 26L32 8L40 26", "M3 5L7 9M56 53L61 58"],
};
export function BadgeArt({ motif }: { motif: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">{drawings[motif]?.map((d, i) => <path key={i} d={d} />)}</svg>;
}
export const badgeDesigns = {
  focus: [
    ["flame","drop","#ffd0a1","#b85b2a","rise","第一束火光，來自你願意開始。"],
    ["book","square","#bddcfa","#476c9d","open","每次坐回書桌，都在拓展你的世界。"],
    ["hourglass","arch","#ffe8a7","#967127","flip","十次投入，讓時間留下了形狀。"],
    ["compass","round","#a9e0e3","#327c83","orbit","你已找到，屬於自己的專注方向。"],
    ["star","star","#c8b8ff","#7155af","burst","那些安靜努力的日子，現在都發光了。"],
    ["crown","crest","#ffe291","#9d7022","land","一百次選擇專注，為自己加冕。"],
  ],
  checkin: [
    ["flag","crest","#bce3ed","#367f91","land","旗幟升起，你的旅程正式開始。"],
    ["sprout","drop","#cbeaa7","#55833b","grow","連續三天，習慣已經悄悄發芽。"],
    ["sun","round","#ffe3a0","#b77b22","burst","一週的堅持，點亮一顆小太陽。"],
    ["moon","arch","#c6cfff","#606faa","rise","半個月的足跡，也能照亮夜晚。"],
    ["wand","star","#e8bce8","#985a98","flip","你施展的魔法，叫做持續出現。"],
    ["galaxy","square","#a7d8de","#376b8c","orbit","三十天，讓小習慣擁有自己的星系。"],
  ],
  weakness: [
    ["bolt","arch","#ffe49b","#a67925","burst","卡住的地方，終於出現第一道光。"],
    ["map","square","#d7dfab","#778342","open","每一個錯因，都是下一步的路標。"],
    ["shield","crest","#b4cafa","#526d9d","land","五次突破，讓你的信心多一層守護。"],
    ["repair","round","#afe2cb","#388371","flip","把不懂的觀念，一點一點修復。"],
    ["trophy","drop","#ffd1aa","#b37639","rise","二十次不放棄，值得一座獎盃。"],
    ["gem","star","#b8dbee","#537da6","grow","五十道難關，磨出你的獨特光芒。"],
  ],
} as const;
