import { describe, expect, it } from 'vitest';
import {
  createActiveSolveTimer,
  formatActiveSolveTime,
  getActiveSolveMilliseconds,
  setActiveSolveTimerVisibility,
  startActiveSolveTimer,
  stopActiveSolveTimer,
} from './active-solve-timer';

describe('active solve timer', () => {
  it('starts on demand, excludes hidden time, and stops at result', () => {
    let timer = createActiveSolveTimer();
    expect(getActiveSolveMilliseconds(timer, 500)).toBe(0);

    timer = startActiveSolveTimer(timer, 1_000, true);
    expect(getActiveSolveMilliseconds(timer, 3_500)).toBe(2_500);
    timer = setActiveSolveTimerVisibility(timer, false, 3_500);
    expect(getActiveSolveMilliseconds(timer, 9_000)).toBe(2_500);
    timer = setActiveSolveTimerVisibility(timer, true, 9_000);
    timer = stopActiveSolveTimer(timer, 10_000);

    expect(getActiveSolveMilliseconds(timer, 20_000)).toBe(3_500);
    expect(timer.stopped).toBe(true);
  });

  it('does not count time before becoming visible after the first swap', () => {
    let timer = startActiveSolveTimer(createActiveSolveTimer(), 1_000, false);
    expect(getActiveSolveMilliseconds(timer, 8_000)).toBe(0);
    timer = setActiveSolveTimerVisibility(timer, true, 8_000);
    expect(getActiveSolveMilliseconds(timer, 9_250)).toBe(1_250);
  });

  it('formats elapsed active time as m:ss', () => {
    expect(formatActiveSolveTime(0)).toBe('0:00');
    expect(formatActiveSolveTime(59_999)).toBe('0:59');
    expect(formatActiveSolveTime(60_000)).toBe('1:00');
    expect(formatActiveSolveTime(3_661_000)).toBe('61:01');
  });
});
