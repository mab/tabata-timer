# Tabata Timer

A phone-first interval timer built with TypeScript and Vite. It has no framework, account, or server-side runtime.

## Local development

The project pins Node.js LTS with mise. Install mise, then run:

```sh
mise install
npm ci
npm run dev
```

Run the timer tests and production build with:

```sh
npm test
npm run build
```

The build is written to `dist/` and can be served by any static host.

## GitHub Pages

The included Actions workflow runs tests, builds the site, and deploys `dist/` on pushes to `main`. In the repository settings, choose **Pages → Build and deployment → GitHub Actions**. Vite uses relative asset paths so the app also works from a repository project URL. No backend is required.

## Browser behavior

The timer derives progress from deadlines and reconciles when the tab becomes visible again. Browser suspension can delay notifications; background sounds and vibration are not guaranteed. Audio starts from the Start/Resume action. Vibration support varies by browser. Screen Wake Lock requires a supported secure context, can be denied or released by the device, and does not guarantee background JavaScript execution. Preferences are stored locally in the browser.
