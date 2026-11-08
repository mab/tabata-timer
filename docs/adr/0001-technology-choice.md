# ADR 0001: Technology Choice

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Build a phone-first Tabata timer as a focused, accessible workout interface. It needs a small but meaningful state machine (preparation, work, rest, cooldown, complete), configurable settings, pause/resume/reset behavior, deadline-based timekeeping, focused transition tests, and progressive use of browser audio, vibration, and Screen Wake Lock APIs.

The app has no account, backend, or server-side needs. It must be hosted as a static site on GitHub Pages. The workspace is currently empty, so there is no existing framework, design system, or toolchain to extend.

## Decision Drivers

- Keep the interface fast, touch-friendly, and accessible on phones.
- Keep timer transitions deterministic and testable, including pause/resume and background reconciliation.
- Prefer the least complex approach that still meets the product brief.
- Keep production deployment static and compatible with GitHub Pages project-site paths.
- Avoid unnecessary dependencies, runtime weight, and framework conventions.

## Options Considered

### 1. Semantic HTML/CSS with vanilla JavaScript

Use semantic markup and CSS for the interface, plus native JavaScript ES modules for the timer and browser APIs. Isolate time/transition logic in a module that can be tested with Node's built-in test runner. Publish the static source files directly through GitHub Pages, with no production build.

**Advantages:** Smallest toolchain; direct access to browser APIs; no framework or production dependency; no build output or artifact path to maintain; static files can be served from a GitHub Pages project path using relative asset URLs.

**Tradeoffs:** State and settings contracts are not checked by a compiler. Keep modules and state transitions explicit, validate persisted/user input at runtime, and test the timer engine independently of the DOM.

### 2. Semantic HTML/CSS with TypeScript compiled to JavaScript

Use TypeScript for the timer and UI logic and compile it to static JavaScript during a build, optionally with a bundler such as Vite.

**Advantages:** Types can make phase/state transitions, settings, and optional browser API handling easier to maintain as behavior grows. TypeScript also pairs well with focused unit tests.

**Tradeoffs:** Adds a compiler, package configuration, build artifacts, and a GitHub Actions build/deploy workflow. It still cannot guarantee browser timing or API availability; those require runtime handling and tests either way. For this bounded single-screen app, the extra static checks do not yet justify the added toolchain.

### 3. Framework-based application

Use a UI framework such as React or Vue, with or without TypeScript.

**Advantages:** Component and state-management conventions can help when an application has multiple views, complex shared UI, or a larger team.

**Tradeoffs:** This app has one primary workout view and a small state model. A framework would add dependencies, build configuration, and deployment complexity without solving timing, audio, vibration, or wake-lock limitations. No concrete framework benefit is currently required by the brief.

## Recommendation

Use **semantic HTML and CSS with TypeScript compiled to JavaScript**, without a frontend framework. Use Vite to compile and bundle the app into static files and Vitest to test the isolated timer engine. Keep timing logic separate from DOM rendering, derive phase and remaining time from an absolute deadline or elapsed clock rather than decrementing a counter, and handle browser APIs as optional runtime capabilities.

The user approved this option. TypeScript's explicit workout/settings types and discriminated timer states support safer transitions and focused testing. A framework is not needed for the app's single primary workout view.

## Consequences

- The deployed app is static HTML, CSS, and compiled JavaScript. GitHub Pages serves the Vite build output (`dist/`); no server-side runtime is needed.
- Use Vite's relative base (`./`) so project-site asset URLs work, and deploy the output with a GitHub Actions Pages workflow.
- Run the build and focused logic tests locally with Node.js/npm; these are development prerequisites only, not production requirements.
- TypeScript checks state and settings contracts at build time, while runtime validation remains necessary for user input, local storage, and browser APIs. Cover transitions, pause/resume, reset, and completion in tests.
- Browser suspension may delay cues and JavaScript callbacks. Reconcile from elapsed time/deadline when the page becomes visible; do not promise background audio or vibration. Audio must be enabled from a user gesture, vibration is not supported in every browser (including iOS Safari), and Screen Wake Lock requires a supported secure context, may be denied/released, and is not guaranteed to keep a suspended page executing.
- Persist only settings locally. If browser storage or optional APIs fail, the core timer remains usable with an explanatory status message.
