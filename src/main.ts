import './style.css';
import {
  DEFAULT_WORKOUT,
  TabataTimer,
  WORKOUT_LIMITS,
  isWorkoutConfig,
  type TimerSnapshot,
  type WorkoutConfig,
  type WorkoutPhase,
} from './timer/model';

interface Preferences {
  workout: WorkoutConfig;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  wakeLockEnabled: boolean;
}

const PREFERENCES_KEY = 'tabata-timer.preferences.v1';
const DEFAULT_PREFERENCES: Preferences = {
  workout: { ...DEFAULT_WORKOUT },
  soundEnabled: true,
  vibrationEnabled: false,
  wakeLockEnabled: true,
};

const app = requiredElement<HTMLDivElement>('#app');
const ring = requiredElement<HTMLDivElement>('#timer-ring');
const phaseLabel = requiredElement<HTMLSpanElement>('#phase-label');
const timeRemaining = requiredElement<HTMLSpanElement>('#time-remaining');
const roundCount = requiredElement<HTMLParagraphElement>('#round-count');
const phaseCaption = requiredElement<HTMLParagraphElement>('#phase-caption');
const timerStatus = requiredElement<HTMLSpanElement>('#timer-status');
const primaryAction = requiredElement<HTMLButtonElement>('#primary-action');
const resetAction = requiredElement<HTMLButtonElement>('#reset-action');
const settingsForm = requiredElement<HTMLFormElement>('#settings-form');
const settingsFieldset = requiredElement<HTMLFieldSetElement>('#settings-fieldset');
const classicDefaults = requiredElement<HTMLButtonElement>('#classic-defaults');
const appNotice = requiredElement<HTMLParagraphElement>('#app-notice');
const spokenStatus = requiredElement<HTMLParagraphElement>('#spoken-status');
const vibrationNote = requiredElement<HTMLSpanElement>('#vibration-note');
const wakeLockNote = requiredElement<HTMLSpanElement>('#wake-lock-note');

const workoutFields: Record<keyof WorkoutConfig, HTMLInputElement> = {
  workSeconds: requiredElement<HTMLInputElement>('#workSeconds'),
  restSeconds: requiredElement<HTMLInputElement>('#restSeconds'),
  rounds: requiredElement<HTMLInputElement>('#rounds'),
  preparationSeconds: requiredElement<HTMLInputElement>('#preparationSeconds'),
  cooldownSeconds: requiredElement<HTMLInputElement>('#cooldownSeconds'),
};
const soundField = requiredElement<HTMLInputElement>('#soundEnabled');
const vibrationField = requiredElement<HTMLInputElement>('#vibrationEnabled');
const wakeLockField = requiredElement<HTMLInputElement>('#wakeLockEnabled');

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function readPreferences(): { preferences: Preferences; notice: string } {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return { preferences: structuredClone(DEFAULT_PREFERENCES), notice: '' };

    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null) {
      return {
        preferences: structuredClone(DEFAULT_PREFERENCES),
        notice: 'Saved preferences were invalid. Classic settings have been restored.',
      };
    }

    const saved = value as Record<string, unknown>;
    const workout = isWorkoutConfig(saved.workout) ? saved.workout : { ...DEFAULT_WORKOUT };
    const invalidWorkout = saved.workout !== undefined && !isWorkoutConfig(saved.workout);

    return {
      preferences: {
        workout,
        soundEnabled:
          typeof saved.soundEnabled === 'boolean'
            ? saved.soundEnabled
            : DEFAULT_PREFERENCES.soundEnabled,
        vibrationEnabled:
          typeof saved.vibrationEnabled === 'boolean'
            ? saved.vibrationEnabled
            : DEFAULT_PREFERENCES.vibrationEnabled,
        wakeLockEnabled:
          typeof saved.wakeLockEnabled === 'boolean'
            ? saved.wakeLockEnabled
            : DEFAULT_PREFERENCES.wakeLockEnabled,
      },
      notice: invalidWorkout ? 'Saved workout values were invalid. Classic timings have been restored.' : '',
    };
  } catch {
    return {
      preferences: structuredClone(DEFAULT_PREFERENCES),
      notice: 'Local storage is unavailable. Settings will not persist on this device.',
    };
  }
}

let preferences = readPreferences();
let timer = new TabataTimer(preferences.preferences.workout);
let snapshot = timer.snapshot(Date.now());
let audioContext: AudioContext | null = null;
let wakeLock: WakeLockSentinel | null = null;
let ticker: number | undefined;
let lastAnnouncementKey = '';

function showNotice(message: string): void {
  appNotice.textContent = message;
}

function savePreferences(): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences.preferences));
    return true;
  } catch {
    return false;
  }
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function phaseName(phase: WorkoutPhase): string {
  const names: Record<WorkoutPhase, string> = {
    ready: 'Ready',
    preparation: 'Preparation',
    work: 'Work',
    rest: 'Rest',
    cooldown: 'Cooldown',
    complete: 'Complete',
  };
  return names[phase];
}

function updateAnnouncement(current: TimerSnapshot): void {
  const key = `${current.phase}:${current.round}:${current.status}`;
  if (key !== lastAnnouncementKey) {
    const detail = `${phaseName(current.phase)}. Round ${current.round} of ${current.totalRounds}.`;
    const status = current.status === 'paused' ? ' Paused.' : current.status === 'complete' ? ' Workout complete.' : '';
    const announcement = `${detail}${status} Time remaining ${formatTime(current.remainingMs)}.`;
    spokenStatus.textContent = announcement;
    lastAnnouncementKey = key;
  }
}

function render(current: TimerSnapshot): void {
  const phaseProgress =
    current.phaseDurationMs > 0
      ? Math.min(1, Math.max(0, 1 - current.remainingMs / current.phaseDurationMs))
      : 1;

  app.dataset.phase = current.phase;
  ring.style.setProperty('--timer-progress', `${phaseProgress * 100}%`);
  phaseLabel.textContent = phaseName(current.phase).toUpperCase();
  timeRemaining.textContent = formatTime(current.remainingMs);
  roundCount.innerHTML = `ROUND ${String(current.round).padStart(2, '0')} <span>/</span> ${String(current.totalRounds).padStart(2, '0')}`;
  timerStatus.textContent =
    current.status === 'running'
      ? 'IN MOTION'
      : current.status === 'idle'
        ? 'READY'
        : current.status.toUpperCase();
  timerStatus.dataset.status = current.status;

  if (current.phase === 'ready') {
    const { workSeconds, restSeconds } = preferences.preferences.workout;
    phaseCaption.innerHTML = `${workSeconds} SEC WORK <span>·</span> ${restSeconds} SEC REST`;
  } else if (current.phase === 'preparation') {
    phaseCaption.textContent = 'Get into position';
  } else if (current.phase === 'work') {
    phaseCaption.textContent = 'Work interval';
  } else if (current.phase === 'rest') {
    phaseCaption.textContent = 'Rest interval';
  } else if (current.phase === 'cooldown') {
    phaseCaption.textContent = 'Ease out';
  } else {
    phaseCaption.textContent = 'Session complete';
  }

  primaryAction.textContent =
    current.status === 'running'
      ? 'Pause workout'
      : current.status === 'paused'
        ? 'Resume workout'
        : current.status === 'complete'
          ? 'Start again'
          : 'Start workout';
  resetAction.disabled = current.status === 'idle';
  settingsFieldset.disabled = current.status === 'running' || current.status === 'paused';
  classicDefaults.disabled = current.status === 'running' || current.status === 'paused';
  updateAnnouncement(current);
}

function renderCurrent(playCue = true): TimerSnapshot {
  const previous = snapshot;
  snapshot = timer.snapshot(Date.now());
  render(snapshot);

  const phaseAdvanced = previous.phase !== snapshot.phase || previous.round !== snapshot.round;
  if (playCue && phaseAdvanced && !document.hidden) {
    if (snapshot.phase === 'complete') {
      playCompletionCue();
      vibrate([180, 90, 180]);
    } else if (snapshot.status === 'running') {
      playPhaseCue(snapshot.phase);
      vibrate([90]);
    }
  }

  if (snapshot.status === 'complete') {
    stopTicker();
    void releaseWakeLock();
  }
  return snapshot;
}

function startTicker(): void {
  stopTicker();
  ticker = window.setInterval(() => renderCurrent(), 200);
}

function stopTicker(): void {
  if (ticker !== undefined) window.clearInterval(ticker);
  ticker = undefined;
}

async function enableAudio(): Promise<void> {
  if (!preferences.preferences.soundEnabled) return;
  try {
    if (!audioContext) {
      const Context = window.AudioContext;
      if (!Context) {
        showNotice('Sound is not available in this browser.');
        return;
      }
      audioContext = new Context();
    }
    if (audioContext.state === 'suspended') await audioContext.resume();
  } catch {
    showNotice('Sound could not start. Check your browser audio settings.');
  }
}

function playTone(frequency: number, when: number, duration: number, volume = 0.12): void {
  if (!audioContext || !preferences.preferences.soundEnabled) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(when);
  oscillator.stop(when + duration + 0.02);
}

function playPhaseCue(phase: WorkoutPhase): void {
  if (!audioContext || !preferences.preferences.soundEnabled) return;
  const frequency = phase === 'work' ? 780 : phase === 'rest' ? 510 : phase === 'cooldown' ? 650 : 590;
  const now = audioContext.currentTime;
  playTone(frequency, now, 0.22);
  if (phase === 'preparation') playTone(740, now + 0.28, 0.22);
}

function playCompletionCue(): void {
  if (!audioContext || !preferences.preferences.soundEnabled) return;
  const now = audioContext.currentTime;
  playTone(660, now, 0.2);
  playTone(830, now + 0.24, 0.2);
  playTone(1040, now + 0.48, 0.42, 0.15);
}

function vibrate(pattern: number | number[]): void {
  if (!preferences.preferences.vibrationEnabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    showNotice('Vibration is unavailable on this device.');
  }
}

async function requestWakeLock(): Promise<void> {
  if (
    !preferences.preferences.wakeLockEnabled ||
    snapshot.status !== 'running' ||
    document.hidden ||
    wakeLock?.released
  ) {
    return;
  }

  const wakeLockApi = navigator.wakeLock;
  if (!wakeLockApi || !window.isSecureContext) return;

  try {
    const requestedLock = await wakeLockApi.request('screen');
    if (snapshot.status !== 'running' || !preferences.preferences.wakeLockEnabled || document.hidden) {
      await requestedLock.release();
      return;
    }
    wakeLock = requestedLock;
    const currentLock = requestedLock;
    currentLock.addEventListener('release', () => {
      if (wakeLock === currentLock) wakeLock = null;
    });
  } catch {
    showNotice('The screen could not be kept awake. You may need to adjust your device display settings.');
  }
}

async function releaseWakeLock(): Promise<void> {
  const currentLock = wakeLock;
  wakeLock = null;
  if (!currentLock || currentLock.released) return;
  try {
    await currentLock.release();
  } catch {
    showNotice('The screen wake lock could not be released by the browser.');
  }
}

function syncForm(): void {
  for (const [key, input] of Object.entries(workoutFields) as [keyof WorkoutConfig, HTMLInputElement][]) {
    input.value = String(preferences.preferences.workout[key]);
    input.removeAttribute('aria-invalid');
  }
  soundField.checked = preferences.preferences.soundEnabled;
  vibrationField.checked = preferences.preferences.vibrationEnabled;
  wakeLockField.checked = preferences.preferences.wakeLockEnabled;
}

function readWorkoutForm(): WorkoutConfig {
  return {
    workSeconds: Number(workoutFields.workSeconds.value),
    restSeconds: Number(workoutFields.restSeconds.value),
    rounds: Number(workoutFields.rounds.value),
    preparationSeconds: Number(workoutFields.preparationSeconds.value),
    cooldownSeconds: Number(workoutFields.cooldownSeconds.value),
  };
}

function updateWorkoutFromForm(): void {
  const workout = readWorkoutForm();
  if (!isWorkoutConfig(workout)) {
    for (const key of Object.keys(workoutFields) as (keyof WorkoutConfig)[]) {
      const field = workoutFields[key];
      const value = Number(field.value);
      const bounds = WORKOUT_LIMITS[key];
      const invalid =
        field.value.trim() === '' ||
        !Number.isInteger(value) ||
        value < bounds.min ||
        value > bounds.max;
      field.toggleAttribute('aria-invalid', invalid);
    }
    showNotice('Use whole numbers within the limits shown for each setting.');
    return;
  }

  preferences.preferences.workout = workout;
  timer.setConfig(workout);
  showNotice(
    savePreferences()
      ? ''
      : 'Settings are available for this session, but could not be saved on this device.',
  );
  renderCurrent(false);
}

function setClassicDefaults(): void {
  preferences.preferences.workout = { ...DEFAULT_WORKOUT };
  timer.setConfig(preferences.preferences.workout);
  syncForm();
  showNotice(
    savePreferences()
      ? 'Classic Tabata timings restored. Alert preferences were left unchanged.'
      : 'Classic timings restored for this session, but could not be saved on this device.',
  );
  renderCurrent(false);
}

async function handlePrimaryAction(): Promise<void> {
  if (snapshot.status === 'running') {
    timer.pause(Date.now());
    renderCurrent(false);
    stopTicker();
    await releaseWakeLock();
    return;
  }

  if (snapshot.status === 'paused') {
    await enableAudio();
    timer.resume(Date.now());
  } else {
    await enableAudio();
    timer.start(Date.now());
  }

  showNotice('');
  const current = renderCurrent();
  if (current.status === 'running') {
    startTicker();
    void requestWakeLock();
  }
}

function handleReset(): void {
  const inProgress = snapshot.status === 'running' || snapshot.status === 'paused';
  if (inProgress && !window.confirm('Reset this workout and lose its current progress?')) return;

  timer.reset();
  stopTicker();
  vibrate(0);
  void releaseWakeLock();
  showNotice('');
  renderCurrent(false);
}

primaryAction.addEventListener('click', () => void handlePrimaryAction());
resetAction.addEventListener('click', handleReset);
classicDefaults.addEventListener('click', setClassicDefaults);

for (const input of Object.values(workoutFields)) {
  input.addEventListener('change', updateWorkoutFromForm);
}

soundField.addEventListener('change', () => {
  preferences.preferences.soundEnabled = soundField.checked;
  showNotice(savePreferences() ? '' : 'This preference could not be saved on this device.');
});

vibrationField.addEventListener('change', () => {
  preferences.preferences.vibrationEnabled = vibrationField.checked;
  showNotice(savePreferences() ? '' : 'This preference could not be saved on this device.');
});

wakeLockField.addEventListener('change', () => {
  preferences.preferences.wakeLockEnabled = wakeLockField.checked;
  const saved = savePreferences();
  if (wakeLockField.checked && snapshot.status === 'running') {
    void requestWakeLock();
  } else {
    void releaseWakeLock();
  }
  showNotice(saved ? '' : 'This preference could not be saved on this device.');
});

settingsForm.addEventListener('submit', (event) => event.preventDefault());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (audioContext?.state === 'suspended' && preferences.preferences.soundEnabled) {
    void audioContext.resume().catch(() => showNotice('Sound could not resume after returning to the app.'));
  }
  renderCurrent();
  if (snapshot.status === 'running') void requestWakeLock();
});

syncForm();
vibrationNote.textContent =
  typeof navigator.vibrate === 'function'
    ? 'A short pulse at phase changes'
    : 'Not supported by this browser';
vibrationField.disabled = typeof navigator.vibrate !== 'function';
wakeLockNote.textContent =
  'wakeLock' in navigator && window.isSecureContext
    ? 'While a workout is running'
    : 'Requires a supported secure browser';
showNotice(preferences.notice);
render(snapshot);
