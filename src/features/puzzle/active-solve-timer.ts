export interface ActiveSolveTimer {
  readonly elapsedMilliseconds: number;
  readonly runningSince: number | null;
  readonly started: boolean;
  readonly stopped: boolean;
}

export function createActiveSolveTimer(): ActiveSolveTimer {
  return { elapsedMilliseconds: 0, runningSince: null, started: false, stopped: false };
}

export function startActiveSolveTimer(
  timer: ActiveSolveTimer,
  now: number,
  visible = true,
): ActiveSolveTimer {
  if (timer.started || timer.stopped) return timer;
  return { ...timer, started: true, runningSince: visible ? now : null };
}

export function setActiveSolveTimerVisibility(
  timer: ActiveSolveTimer,
  visible: boolean,
  now: number,
): ActiveSolveTimer {
  if (!timer.started || timer.stopped) return timer;
  if (visible && timer.runningSince === null) return { ...timer, runningSince: now };
  if (!visible && timer.runningSince !== null) {
    return {
      ...timer,
      elapsedMilliseconds: timer.elapsedMilliseconds + Math.max(0, now - timer.runningSince),
      runningSince: null,
    };
  }
  return timer;
}

export function stopActiveSolveTimer(timer: ActiveSolveTimer, now: number): ActiveSolveTimer {
  if (timer.stopped) return timer;
  const elapsedMilliseconds = timer.runningSince === null
    ? timer.elapsedMilliseconds
    : timer.elapsedMilliseconds + Math.max(0, now - timer.runningSince);
  return { ...timer, elapsedMilliseconds, runningSince: null, stopped: true };
}

export function getActiveSolveMilliseconds(timer: ActiveSolveTimer, now: number): number {
  return timer.elapsedMilliseconds + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));
}

export function formatActiveSolveTime(elapsedMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
