// P0: growth tracking uses example data only. Later it can read from learning.ts or a backend store.
export type GrowthSnapshot = {
  streakDays: number;
  totalMinutes: number;
  lastScore: number;
  weakAreaZh: string;
  nextPracticeZh: string;
  nextTipZh: string;
};

export const GROWTH_MOCK: GrowthSnapshot = {
  streakDays: 3,
  totalMinutes: 28,
  lastScore: 76,
  weakAreaZh: "结果量化表达",
  nextPracticeZh: "面试 · 项目成果追问",
  nextTipZh: '把 "improved route flow" 说成 "reduced route search time by 30%".'
};
