import type { TranscriptResult } from "../../shared/schemas";

type TranscriptWord = TranscriptResult["words"][number];
type SpeechEvidence = Pick<
  TranscriptResult,
  "speechRateWpm" | "lowConfidenceWords" | "pauseEvents" | "pronunciationNotes"
>;

type SpeechEvidenceInput = {
  text: string;
  confidence: number;
  words: TranscriptWord[];
  durationSec: number;
  provider: string;
};

const LOW_CONFIDENCE_THRESHOLD = 0.8;
const PAUSE_THRESHOLD_SEC = 0.65;

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

function countSpokenWords(input: SpeechEvidenceInput) {
  if (input.words.length) return input.words.length;
  return input.text.trim() ? input.text.trim().split(/\s+/).length : 0;
}

function calculateSpeechRate(input: SpeechEvidenceInput) {
  const spokenWords = countSpokenWords(input);
  if (!spokenWords || input.durationSec <= 0) return 0;
  return Math.round((spokenWords / input.durationSec) * 60);
}

function displayWord(word: TranscriptWord) {
  return word.punctuatedWord || word.word;
}

export function deriveSpeechEvidence(input: SpeechEvidenceInput): SpeechEvidence {
  const speechRateWpm = calculateSpeechRate(input);
  const lowConfidenceWords = input.words
    .filter((word) => word.confidence < LOW_CONFIDENCE_THRESHOLD)
    .map((word) => ({
      word: word.word,
      punctuatedWord: word.punctuatedWord,
      start: word.start,
      end: word.end,
      confidence: roundMetric(word.confidence)
    }));
  const pauseEvents = input.words.slice(1).flatMap((word, index) => {
    const previous = input.words[index];
    const gap = word.start - previous.end;
    if (gap < PAUSE_THRESHOLD_SEC) return [];
    return [
      {
        afterWord: displayWord(previous),
        beforeWord: displayWord(word),
        start: roundMetric(previous.end),
        end: roundMetric(word.start),
        durationSec: roundMetric(gap)
      }
    ];
  });

  const pronunciationNotes = [
    `规则估算：基于 ${input.provider} 转写置信度、词级时间戳和语速生成。`
  ];

  if (lowConfidenceWords.length) {
    pronunciationNotes.push(
      `低置信词：${lowConfidenceWords.map((word) => word.punctuatedWord || word.word).join(", ")}，建议回听这些词的重音和结尾。`
    );
  } else {
    pronunciationNotes.push("低置信词较少，整体清晰度稳定。");
  }

  if (speechRateWpm > 0 && speechRateWpm < 90) {
    pronunciationNotes.push(`语速偏慢，约 ${speechRateWpm} WPM；下一轮先短答，再补例子。`);
  } else if (speechRateWpm > 165) {
    pronunciationNotes.push(`语速偏快，约 ${speechRateWpm} WPM；建议放慢关键词和句尾。`);
  } else if (speechRateWpm > 0) {
    pronunciationNotes.push(`语速稳定，约 ${speechRateWpm} WPM。`);
  } else {
    pronunciationNotes.push("语速暂不可估算，建议使用录音转写后查看。");
  }

  if (pauseEvents.length) {
    pronunciationNotes.push(`检测到 ${pauseEvents.length} 处明显停顿，优先练习连接词和短句衔接。`);
  }

  return {
    speechRateWpm,
    lowConfidenceWords,
    pauseEvents,
    pronunciationNotes
  };
}
