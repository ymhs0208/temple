import { pilgrimageStops } from "./pilgrimage-data";
import { learningUrl } from "./line-reminder";

export function isPilgrimageCommand(command: string) {
  return /七個關卡|七關|七媽|巡禮|宮廟|關卡地點/.test(command);
}

export function buildPilgrimageFlex() {
  return {
    type: "flex", altText: "七媽巡禮・七個關卡地點、故事與地圖導航",
    contents: {
      type: "carousel",
      contents: pilgrimageStops.map((stop, index) => ({
        type: "bubble", size: "mega",
        header: { type: "box", layout: "vertical", backgroundColor: "#245747", paddingAll: "20px", spacing: "sm", contents: [
          { type: "text", text: `七媽巡禮 / 第 ${index + 1} 關，共 7 關`, size: "xs", color: "#E5EDE9" },
          { type: "text", text: stop.name, size: "lg", weight: "bold", color: "#FFFFFF", wrap: true },
        ] },
        body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md", contents: [
          { type: "text", text: stop.highlight, size: "sm", color: "#40564A", wrap: true },
          { type: "separator", color: "#E5EDE9" },
          { type: "text", text: stop.address, size: "sm", color: "#40564A", wrap: true },
          { type: "text", text: "關卡依活動順序解鎖；請在巡禮頁查看進度與現場掃碼。", size: "xs", color: "#718176", wrap: true },
        ] },
        footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "20px", paddingTop: "0px", contents: [
          { type: "button", style: "primary", color: "#245747", action: { type: "uri", label: "開啟關卡故事", uri: learningUrl(`/pilgrimage/${stop.id}`) } },
          { type: "button", style: "secondary", action: { type: "uri", label: "地圖導航", uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}` } },
          { type: "button", style: "link", color: "#617668", action: { type: "uri", label: "我的巡禮・現場掃碼", uri: learningUrl("/pilgrimage") } },
        ] },
      })),
    },
  };
}
