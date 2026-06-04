export type ScenarioTask = {
  id: string;
  titleZh: string;
  titleEn: string;
  aiRoleZh: string;
  focus: string;
  openingQuestion: string;
};

export type Scenario = {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  tasks: ScenarioTask[];
};

export const scenarios: Scenario[] = [
  {
    id: "interview",
    nameZh: "面试",
    nameEn: "Interview",
    descriptionZh: "练习自我介绍、项目经历和追问回应。",
    tasks: [
      {
        id: "internship-intro",
        titleZh: "实习面试自我介绍",
        titleEn: "Internship introduction",
        aiRoleZh: "AI 面试官",
        focus: "把项目结果说清楚",
        openingQuestion: "Tell me about one project you are proud of."
      },
      {
        id: "strengths-plan",
        titleZh: "优点与职业规划",
        titleEn: "Strengths and career plan",
        aiRoleZh: "AI 面试官",
        focus: "先结论后例子",
        openingQuestion: "What is one strength that would help you in this role?"
      }
    ]
  },
  {
    id: "meeting",
    nameZh: "会议",
    nameEn: "Meeting",
    descriptionZh: "练习表达观点、确认任务和礼貌不同意。",
    tasks: [
      {
        id: "share-opinion",
        titleZh: "表达项目观点",
        titleEn: "Share an opinion",
        aiRoleZh: "AI 会议主持",
        focus: "观点明确、理由简短",
        openingQuestion: "What do you think is the biggest risk in this plan?"
      }
    ]
  },
  {
    id: "restaurant",
    nameZh: "点餐",
    nameEn: "Restaurant",
    descriptionZh: "练习询问推荐、表达偏好和处理追问。",
    tasks: [
      {
        id: "order-with-preference",
        titleZh: "带偏好的点餐",
        titleEn: "Order with preferences",
        aiRoleZh: "AI 服务员",
        focus: "表达限制和偏好",
        openingQuestion: "Hi, what would you like to order today?"
      }
    ]
  }
];

export function findScenarioTask(scenarioId: string, taskId: string): {
  scenario: Scenario;
  task: ScenarioTask;
} {
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const task = scenario.tasks.find((item) => item.id === taskId) ?? scenario.tasks[0];
  return { scenario, task };
}
