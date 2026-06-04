import {
  applyPracticeCompletion,
  createEmptyCheckinState,
  getShanghaiDate,
  type CheckinState
} from "./domain/checkin";

const KEY = "ai-speaking-coach-checkin";

export function loadCheckin(): CheckinState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...createEmptyCheckinState(), ...JSON.parse(raw) } : createEmptyCheckinState();
  } catch {
    return createEmptyCheckinState();
  }
}

export function saveCheckin(state: CheckinState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function completeToday(score: number, reportId: string, now = new Date()) {
  const next = applyPracticeCompletion(loadCheckin(), {
    date: getShanghaiDate(now),
    score,
    reportId
  });
  saveCheckin(next);
  return next;
}
