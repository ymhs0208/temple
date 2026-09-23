export type PlanningTask = { id: string; subject: string; minutes: number; task_type: string };

const chineseNumbers: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

export function parseAvailableMinutes(source: string) {
  const command = source.replace(/\s+/g, "");
  if (/半小時/.test(command)) return 30;
  const arabic = command.match(/(\d+(?:\.\d+)?)\s*(小時|分鐘|分|min)/i);
  if (arabic) return Math.max(1, Math.round(Number(arabic[1]) * (arabic[2].toLowerCase() === "小時" ? 60 : 1)));
  const chinese = command.match(/([一二兩三四五六七八九十]+)小時/);
  if (chinese) {
    const hours = chinese[1].length === 2 && chinese[1][0] === "十"
      ? 10 + (chineseNumbers[chinese[1][1]] ?? 0)
      : chinese[1].startsWith("十") ? 10 : chinese[1].split("").reduce((sum, value) => sum * 10 + (chineseNumbers[value] ?? 0), 0);
    return hours * 60;
  }
  return null;
}

export function buildTimePlan(tasks: PlanningTask[], completed: Set<string>, source: string) {
  const capacity = parseAvailableMinutes(source);
  if (!capacity) return { capacity: null, tasks: [] as PlanningTask[] };
  let remaining = capacity;
  const selected = tasks.filter(task => !completed.has(task.id)).flatMap(task => {
    if (remaining <= 0) return [];
    const minutes = Math.min(task.minutes, remaining);
    remaining -= minutes;
    return [{ ...task, minutes }];
  });
  return { capacity, tasks: selected };
}
