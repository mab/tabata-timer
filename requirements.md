# Tabata Timer Requirements

## Product checklist

- [x] Phone-first workout screen with no horizontal scrolling; remains usable on tablet and desktop.
- [x] Classic preset: 20 seconds work, 10 seconds rest, 8 rounds.
- [x] Editable work/rest durations, round count, preparation countdown, and optional cooldown; settings are protected during a workout.
- [x] Clearly name preparation, work, rest, cooldown, and complete phases; show remaining time and current/total rounds at a glance.
- [x] Provide start, pause/resume, and reset. Confirm reset only while a workout is unfinished, including while paused.
- [x] Cue phase changes and completion distinctly. Sound and vibration can be switched off independently and fail gracefully when unavailable.
- [x] Derive elapsed/remaining time from a deadline or elapsed clock, not a decrementing one-second counter; reconcile after the page becomes visible again.
- [x] Request a screen wake lock during an active workout when supported; release it while paused or finished.
- [x] Persist preferences locally without accounts or backend services; provide a restore-classic-defaults action.
- [x] Use accessible names, visible focus, sufficient contrast, and phase text/icons or other non-color cues; respect reduced-motion preferences.
- [x] Explain browser limitations around audio, vibration, and keeping the display awake.
- [x] Validate configuration, handle browser API failures, and add focused tests for transitions, pause/resume, reset, and completion.
- [x] Deploy as a static site on GitHub Pages, with documented build and deployment steps.

## Assumptions to validate

- [ ] Initial workout values: work 20 seconds, rest 10 seconds, 8 rounds, preparation 5 seconds, cooldown disabled (0 seconds).
- [ ] Round count means the number of work intervals. Rest follows each work interval except the final one; enabled cooldown follows the final work interval.
- [ ] Proposed input bounds: work/rest 1-600 seconds, rounds 1-99, preparation 0-60 seconds, cooldown 0-600 seconds. Invalid stored or entered values are rejected or clamped with clear feedback.
- [ ] Sound is enabled by default; vibration is off by default and only offered when the browser exposes support. Wake-lock requests are enabled by default when supported.
- [ ] Restoring classic defaults changes workout timings only; it leaves sound, vibration, and wake-lock preferences alone.
- [ ] A reset confirmation is needed in preparation, work, rest, cooldown, or paused states, but not before starting or after completion.
- [ ] When a suspended page resumes, the app derives the current phase from the elapsed deadline and skips stale cues for phases that passed while JavaScript was suspended. Completion is reconciled on resume; browser suspension cannot guarantee real-time audio or vibration.
- [ ] Settings are stored in localStorage. If storage is unavailable, the current session remains usable and a non-blocking notice explains that preferences will not persist.
- [ ] Browser APIs are progressive enhancements: audio starts/resumes from a user gesture; vibration and wake lock may be absent, denied, or released by the operating system. HTTPS is required for wake lock.
