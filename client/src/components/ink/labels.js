// Short status labels written in stroke order. scripts/build-art-assets.mjs collects
// their characters into hanzi-medians.js; add a label here, then rerun the script.
// Other text (counts, names, words) falls back to the static font.
export const inkLabels = {
  enter: "进入大厅",
  lobby: "大厅",
  draw: "轮到你画",
  guess: "轮到你猜",
  prompt: "轮到你出题",
  judge: "轮到你裁定",
  drawing: "正在作画",
  waitPrompt: "等待出题",
  waitHost: "等房主开局",
  ready: "可以开局",
  waiting: "等待开局",
  guessed: "猜中了！",
  timeout: "时间到",
  skipped: "房主结束本轮",
  left: "玩家离开",
  finished: "本轮结束",
};
