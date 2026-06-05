import type { ScoreDimensionId } from "../shared/schemas";

export type TaskDifficulty = "A2" | "B1" | "B2";

export type TaskRubricItem = {
  dimension: ScoreDimensionId;
  expectationZh: string;
};

export type ScenarioTask = {
  id: string;
  titleZh: string;
  titleEn: string;
  aiRoleZh: string;
  focus: string;
  openingQuestion: string;
  difficulty: TaskDifficulty;
  roundGoals: string[];
  rubric: TaskRubricItem[];
  sampleAnswers: string[];
  commonMistakes: string[];
};

export type Scenario = {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  tasks: ScenarioTask[];
};

type TaskInput = Omit<ScenarioTask, "rubric"> & {
  rubric?: TaskRubricItem[];
};

const dimensionOrder: ScoreDimensionId[] = [
  "pronunciation",
  "fluency",
  "grammar",
  "expression",
  "taskCompletion"
];

function createRubric(focus: string): TaskRubricItem[] {
  return [
    { dimension: "pronunciation", expectationZh: "关键词清晰，句尾不吞音，长词可以放慢。" },
    { dimension: "fluency", expectationZh: "先短答，再补例子，减少长停顿和重复开头。" },
    { dimension: "grammar", expectationZh: "时态、冠词和单复数稳定，避免基础错误影响理解。" },
    { dimension: "expression", expectationZh: `表达围绕“${focus}”，优先使用自然短句。` },
    { dimension: "taskCompletion", expectationZh: "回答覆盖问题核心，并能推动下一轮追问。" }
  ];
}

export function createTaskMetadata(input: {
  focus: string;
  difficulty?: TaskDifficulty;
  roundGoals?: string[];
  sampleAnswers?: string[];
  commonMistakes?: string[];
}): Pick<ScenarioTask, "difficulty" | "roundGoals" | "rubric" | "sampleAnswers" | "commonMistakes"> {
  return {
    difficulty: input.difficulty ?? "B1",
    roundGoals:
      input.roundGoals?.length === 5
        ? input.roundGoals
        : [
            "直接回答问题，不先铺垫背景。",
            "补一个具体例子或场景细节。",
            "加入数字、结果或用户影响。",
            "回应追问并承认一个取舍。",
            "用两句自信总结收尾。"
          ],
    rubric: createRubric(input.focus).sort(
      (left, right) => dimensionOrder.indexOf(left.dimension) - dimensionOrder.indexOf(right.dimension)
    ),
    sampleAnswers:
      input.sampleAnswers?.length
        ? input.sampleAnswers
        : [
            "My main point is clear, and I can give one concrete example.",
            "The result was useful because it saved time and reduced confusion."
          ],
    commonMistakes:
      input.commonMistakes?.length
        ? input.commonMistakes
        : ["回答太泛，没有具体结果。", "先讲过程，太晚回答问题核心。"]
  };
}

function createTask(input: TaskInput): ScenarioTask {
  return {
    ...input,
    ...createTaskMetadata(input)
  };
}

export const scenarios: Scenario[] = [
  {
    id: "interview",
    nameZh: "面试",
    nameEn: "Interview",
    descriptionZh: "练习自我介绍、项目经历和追问回应。",
    tasks: [
      createTask({
        id: "internship-intro",
        titleZh: "实习面试自我介绍",
        titleEn: "Internship introduction",
        aiRoleZh: "AI 面试官",
        focus: "把项目结果说清楚",
        openingQuestion: "Tell me about one project you are proud of.",
        difficulty: "B1",
        roundGoals: [
          "用一句话说明项目是什么。",
          "解释你负责的部分。",
          "补充一个可量化结果。",
          "回应项目取舍或困难。",
          "用两句总结为什么适合岗位。"
        ],
        sampleAnswers: [
          "I built a campus navigation app that helped students find classrooms faster.",
          "My role was designing the route flow and testing it with classmates."
        ],
        commonMistakes: ["漏掉冠词：built campus app。", "只讲做了什么，没有讲结果。"]
      }),
      createTask({
        id: "project-impact",
        titleZh: "项目结果说明",
        titleEn: "Project impact explanation",
        aiRoleZh: "AI 面试官",
        focus: "用数字说明影响",
        openingQuestion: "What impact did your project create?",
        difficulty: "B2",
        roundGoals: [
          "先给出项目结果。",
          "补一个数据或用户反馈。",
          "说明你如何验证结果。",
          "承认一个限制并说明改进。",
          "把结果和岗位能力连接起来。"
        ],
        sampleAnswers: [
          "It reduced route planning time by about 20 percent in our small user test.",
          "The biggest impact was making first-year students less anxious before class."
        ],
        commonMistakes: ["数字没有上下文。", "impact 和 effort 混在一起。"]
      }),
      createTask({
        id: "strengths-plan",
        titleZh: "优点与职业规划",
        titleEn: "Strengths and career plan",
        aiRoleZh: "AI 面试官",
        focus: "先结论后例子",
        openingQuestion: "What is one strength that would help you in this role?",
        difficulty: "B1",
        roundGoals: [
          "先说一个明确优点。",
          "用一个真实经历证明。",
          "说明这个优点如何服务岗位。",
          "回应未来成长方向。",
          "用一句自然收尾表达期待。"
        ],
        sampleAnswers: [
          "One strength is that I turn vague problems into small tasks.",
          "In my last project, this helped our team finish the first demo earlier."
        ],
        commonMistakes: ["列举多个优点但没有例子。", "职业规划过空泛。"]
      })
    ]
  },
  {
    id: "meeting",
    nameZh: "会议",
    nameEn: "Meeting",
    descriptionZh: "练习表达观点、确认任务和礼貌不同意。",
    tasks: [
      createTask({
        id: "share-opinion",
        titleZh: "表达项目观点",
        titleEn: "Share an opinion",
        aiRoleZh: "AI 会议主持",
        focus: "观点明确、理由简短",
        openingQuestion: "What do you think is the biggest risk in this plan?",
        difficulty: "B1",
        roundGoals: [
          "直接说出一个风险。",
          "用一句话解释原因。",
          "提出一个轻量解决方案。",
          "回应同事追问。",
          "确认下一步行动。"
        ],
        sampleAnswers: [
          "I think the biggest risk is the timeline, because testing may take longer than expected.",
          "A simple next step is to test the core flow first."
        ],
        commonMistakes: ["只说 I think it is risky，没有具体风险。", "建议太长，会议中难执行。"]
      }),
      createTask({
        id: "clarify-task",
        titleZh: "确认任务分工",
        titleEn: "Clarify action items",
        aiRoleZh: "AI 项目同事",
        focus: "确认责任、时间和交付物",
        openingQuestion: "Can you confirm what you will deliver by Friday?",
        difficulty: "A2",
        roundGoals: [
          "复述自己负责的任务。",
          "说明交付物格式。",
          "确认截止时间。",
          "提出一个需要对方确认的问题。",
          "礼貌收尾并承诺同步进度。"
        ],
        sampleAnswers: [
          "I will deliver the first draft of the user flow by Friday afternoon.",
          "Could you confirm whether you need a slide deck or a written note?"
        ],
        commonMistakes: ["只说 OK，没有复述任务。", "遗漏截止时间或交付物。"]
      }),
      createTask({
        id: "disagree-politely",
        titleZh: "礼貌表达不同意见",
        titleEn: "Disagree politely",
        aiRoleZh: "AI 会议同事",
        focus: "先认可，再提出替代方案",
        openingQuestion: "I think we should launch all features at once. Do you agree?",
        difficulty: "B2",
        roundGoals: [
          "先认可对方目标。",
          "明确表达不同意见。",
          "给出风险原因。",
          "提出替代方案。",
          "邀请对方共同确认。"
        ],
        sampleAnswers: [
          "I see the benefit, but I am a bit concerned about quality risk.",
          "Maybe we can launch the core feature first and keep the rest for the next sprint."
        ],
        commonMistakes: ["直接说 I disagree，显得生硬。", "只否定，没有替代方案。"]
      })
    ]
  },
  {
    id: "restaurant",
    nameZh: "点餐",
    nameEn: "Restaurant",
    descriptionZh: "练习询问推荐、表达偏好和处理追问。",
    tasks: [
      createTask({
        id: "order-with-preference",
        titleZh: "带偏好的点餐",
        titleEn: "Order with preferences",
        aiRoleZh: "AI 服务员",
        focus: "表达限制和偏好",
        openingQuestion: "Hi, what would you like to order today?",
        difficulty: "A2",
        roundGoals: [
          "清楚点一道主菜。",
          "说明一个偏好或限制。",
          "回应服务员追问。",
          "确认价格或配菜。",
          "礼貌完成点单。"
        ],
        sampleAnswers: [
          "I would like the chicken salad, but without onions, please.",
          "Could I have the sauce on the side?"
        ],
        commonMistakes: ["忘记 please，语气偏硬。", "preference 和 allergy 表达不清。"]
      }),
      createTask({
        id: "ask-recommendation",
        titleZh: "询问餐厅推荐",
        titleEn: "Ask for recommendations",
        aiRoleZh: "AI 服务员",
        focus: "说明口味并追问推荐",
        openingQuestion: "Would you like any recommendations from the menu?",
        difficulty: "A2",
        roundGoals: [
          "说明想吃的类型。",
          "询问推荐菜。",
          "追问口味或辣度。",
          "确认最终选择。",
          "礼貌感谢服务员。"
        ],
        sampleAnswers: [
          "Could you recommend something light and not too spicy?",
          "That sounds good. I will take it."
        ],
        commonMistakes: ["recommend 后误加 me a food。", "没有说明口味，服务员难推荐。"]
      }),
      createTask({
        id: "handle-order-problem",
        titleZh: "处理点餐问题",
        titleEn: "Handle an order problem",
        aiRoleZh: "AI 服务员",
        focus: "礼貌说明问题并提出请求",
        openingQuestion: "Is everything okay with your order?",
        difficulty: "B1",
        roundGoals: [
          "礼貌说明问题。",
          "指出具体菜品或细节。",
          "提出一个合理请求。",
          "回应服务员解决方案。",
          "表达感谢并确认。"
        ],
        sampleAnswers: [
          "Excuse me, I think this is not what I ordered.",
          "Could you check if the sauce can be changed?"
        ],
        commonMistakes: ["语气太直接，缺少 Excuse me。", "问题描述不具体。"]
      })
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
