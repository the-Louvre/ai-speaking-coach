# AI Speaking Coach

AI Speaking Coach 是一款面向英语口语练习的 AI 口语陪练工具，目标是帮助用户在面试、点餐、会议等真实场景中进行英语对话训练，并获得可量化的课后反馈。

## 作品信息

- 题目方向：题目一 - AI 英语口语陪练
- 开发窗口：2026-06-05 00:00 至 2026-06-08 23:59，时区为 Asia/Shanghai (UTC+08:00)
- 仓库策略：开发阶段使用私有 GitHub 仓库，截止后按要求设置为可公开访问
- 交付要求：持续 commit 与 PR 记录、README 文档、demo 视频、可复现运行说明

## 核心功能规划

- 场景选择：支持面试、点餐、会议等口语训练场景。
- 实时语音对话：支持用户通过语音进行英语对话练习。
- 发音评测：记录用户语音表现，并给出发音维度反馈。
- 语法与表达纠错：针对用户回答提供语法、词汇和表达优化建议。
- 课后总结：输出本轮练习的表现摘要、问题清单和提升建议。
- 量化反馈：围绕流利度、准确度、发音、表达丰富度等维度形成可追踪指标。
- 虚拟教练互动：原创未来职场教练提供每日提醒、练习陪伴、轻提示和课后点评。
- 轻量打卡：完成每日练习后点亮今日，展示连续练习天数和本周进度。

## 技术栈

当前 Web 端使用以下技术栈：

- 前端：React、TypeScript、Vite。
- 后端：Node.js、Express，本地提供 `/api/*` 接口。
- 数据校验：Zod，用于接口结果和报告结构约束。
- 测试：Vitest、Supertest。
- UI：自定义 Fluent 2 风格 CSS、lucide-react 图标。
- 语音/模型 API 预留：Deepgram ASR、OpenAI LLM、Cartesia TTS。

默认运行 `API_MODE=mock`，不需要任何真实 API Key 即可完成本地 demo。切换 `API_MODE=live` 后，后端会尝试调用第三方 API；缺少 Key 或调用失败时会回退到 mock，避免演示中断。

第三方库或框架使用规则：

- 所有新增依赖必须在 README 或对应 PR 描述中说明用途。
- 所有引用的第三方服务、模型、SDK、UI 库、音频处理库都必须列明。
- 原创功能部分必须在 PR 描述中说明，不能把第三方能力包装为原创实现。

### 第三方能力说明

- Deepgram：用于语音转文字和词级置信度分析，首版 live provider 预留 `nova-3` 调用。
- OpenAI：用于 AI 追问、语法/表达纠错和课后报告生成，默认模型变量为 `OPENAI_LLM_MODEL=gpt-4o-mini`。
- Cartesia：用于 AI 文本转语音，首版 live provider 使用 TTS Bytes endpoint。
- 本项目原创部分：中文口语训练产品流程、Fluent 2 Web 交互、虚拟教练状态机、轻量打卡、场景任务设计、mock 演示链路和评分聚合展示。

## 原创与复用声明

本项目将以本次比赛开发周期内的新提交为准。若复用本人过去代码片段、课程模板或公开示例，必须在对应 PR 描述中注明来源、改动内容和本项目原创部分。

## PR 提交规范

所有功能均基于 PR 添加，每个 PR 只做一件事。PR 描述必须包含：

1. 功能描述：说明本 PR 新增或修改了什么，以及如何使用。
2. 实现思路：说明技术选型或核心实现逻辑。
3. 测试方式：说明如何验证功能正常运行。
4. 依赖与来源：说明新增依赖、参考资料、复用代码来源和原创部分。

建议 PR 节奏：

- PR 1：仓库初始化与 README/模板。
- PR 2：项目脚手架与基础页面壳。
- PR 3：场景选择与练习流程。
- PR 4：语音录制/实时对话。
- PR 5：发音评测与纠错。
- PR 6：课后总结与量化反馈。
- PR 7：demo 视频、README 完整复现说明、最终验收。

## 运行方式

环境要求：

- Node.js 20 或更高版本。
- npm 10 或更高版本。

安装依赖：

```bash
npm install
```

本地启动：

```bash
npm run dev
```

默认地址：

- Web 前端：http://127.0.0.1:5173
- 本地 API：http://127.0.0.1:5174/api/health

测试与构建：

```bash
npm test
npm run typecheck
npm run build
```

### API 模式

默认不需要配置密钥，直接使用 mock：

```bash
API_MODE=mock npm run dev
```

如需测试真实 API，请复制 `.env.example` 为本地 env 文件并自行填入 Key。真实密钥不要提交到仓库。

```bash
cp .env.example .env.local
```

当前 `.gitignore` 会忽略 `.env` 和 `.env.*`，只保留 `.env.example`。

### Demo 路线

1. 打开首页，查看虚拟教练欢迎卡和连续打卡状态。
2. 选择“面试 Interview”场景。
3. 进入实习面试任务，点击“开始 5 分钟练习”。
4. 在练习房间点击“使用模拟转写”或直接输入英文回答。
5. 提交本轮，查看 AI 追问、轻提示和 TTS 状态。
6. 完成至少一轮后点击“结束并生成报告”。
7. 查看总分、五维评分、逐句纠错、建议和今日打卡完成状态。

## 开发记录

开发过程和 PR 计划记录在 [docs/development-plan.md](docs/development-plan.md) 与 [docs/development-log.md](docs/development-log.md)。

## 设计文档

- [产品需求文档](docs/product-requirements.md)
- [UI 信息架构](docs/ui-information-architecture.md)
- [Fluent 2 视觉设计系统](docs/visual-design-system.md)
- [虚拟教练与轻量打卡互动规格](docs/coach-checkin-interactions.md)
