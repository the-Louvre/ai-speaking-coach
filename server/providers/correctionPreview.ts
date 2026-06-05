type CorrectionPreviewInput = {
  userText: string;
  round: number;
  rawPreview?: string;
};

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function hasNumbersOrResults(text: string) {
  return /(\d+|percent|%|improv|reduc|increase|decrease|save|efficien|users?|minutes?|result|impact)/i.test(text);
}

function isCampusTemplateUnrelated(preview: string, userText: string) {
  return /campus navigation/i.test(preview) && !/campus navigation/i.test(userText);
}

function normalizeWhitespace(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function excerpt(text: string, maxLength = 96) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function createSpecificityPreview(userText: string) {
  if (/^this is\b/i.test(userText) || /\bproud\b/i.test(userText)) {
    return "建议更具体：不要只说 “This is my project”。补上项目名称、你做了什么、结果是什么，例如 “I built a project that helped users ...”。";
  }

  return `建议补任务信息：你这句 “${excerpt(userText)}” 还偏泛，下一轮按“我做了什么 + 影响了谁 + 一个结果”来回答。`;
}

function createResultPreview(userText: string) {
  if (/product|efficien|processing|users?|minutes?|%|\d+/i.test(userText)) {
    return "建议保留数字，但压缩重复表达：I improved our product's efficiency by 20%, reduced processing time from 10 minutes to 3 minutes, and helped the team handle more users per day.";
  }

  return `建议把结果前置：先说结论，再补例子。你可以把 “${excerpt(userText)}” 改成更短的“结果 + 证据”结构。`;
}

function shouldKeepRawPreview(rawPreview: string, userText: string) {
  if (!hasChinese(rawPreview)) return false;
  if (isCampusTemplateUnrelated(rawPreview, userText)) return false;
  return true;
}

export function createCorrectionPreview({
  userText,
  round,
  rawPreview
}: CorrectionPreviewInput): string {
  const text = normalizeWhitespace(userText);
  const raw = rawPreview ? normalizeWhitespace(rawPreview) : "";

  if (raw && shouldKeepRawPreview(raw, text)) {
    return raw.startsWith("建议") ? raw : `建议：${raw}`;
  }

  if (!text) {
    return "建议先完成一句完整回答，再补一个具体例子。";
  }

  if (hasNumbersOrResults(text) || round >= 3) {
    return createResultPreview(text);
  }

  return createSpecificityPreview(text);
}
