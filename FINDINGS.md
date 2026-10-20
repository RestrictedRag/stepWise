# Solvely.ai: public web app analysis (REA)

The goal is to build **our own** homework-solver app with similar features. We do not copy their code, assets, copy text or branding.

We ran these with `rea-agents@6.7.0 capture-browser-scenario` (headless Chrome, anonymous, no sign-in, no form submits):

| Evidence ID | Target | Captured |
|---|---|---|
| `ev_5ffd6dc09dee74659757fbc2057cf0a540dc20523e57c1bc1a92a819c28fdb45` | `https://solvely.ai/` + 5s idle | network, console, DOM, a11y, storage (495 events) |
| `ev_116a268f9031c4f6767e28a636667abacb8a3d7e3f0e57cdea46a3ddc0e2d55c` | `https://solvely.ai/ai-math-solver` + 5s idle | same |

Limitations:
- We didn't capture request or response bodies or header values, and storage values are hashed.
- We ran no clicks or solves, so we never saw the actual solve API.
- These are two pages at a single point in time, from one region with US-English settings.

## Observations

### Routes (from `href`s on `/`, ev_5ffd6dc0…)
- **Core:** `/`, `/pricing`, `/tools`, `/blog`, `/mobile`, `/extension`, `/about`, `/contact`
- **Solvers:** `/ai-math-solver`, `/solver/word-problem-solver`, `/solver/equation-solver`, `/solver/photomath`, `/solver/ai-statistics-solver`
- **Calculators:** `/calculator/{solve-for-x,algebra,scientific,geometry,fraction}-calculator-with-steps`
- **Writing:** `/ai-detector`, `/ai-humanizer`, `/ai-paraphraser`, `/plagiarism-checker`, `/grammar-checker`, `/word-counter`
- **Study:** `/ai-quiz-generator`, `/ai-study-guide-maker`, `/ai-flashcard-maker`, `/ai-cheat-sheet-maker`
- **Legal/other:** `/term`, `/privacy-policy`, `/honor-code`, `/responsible-ai`, `/affiliate-program`
- **Locales:** about 18 path prefixes (`/de`, `/es`, `/fr`, `/ja`, …).

### Home page UI (ev_5ffd6dc0…)
- **Nav:** Features ▾, Resources ▾, language picker, "Try for Free" and "Log in".
- **Hero:** an H1 plus a "Get started" CTA.
- **Feature sections:** Homework Solver, Study Tools, Exam Predictor, Writing Assistant and AI Live Notes.
- **Rest of the page, in order:** a logo wall, testimonials, a single-subscription pricing pitch, AI writing tools (detector and humanizer), a free tools grid, an FAQ accordion (the questions are `<button>`s), and a footer.

### Solver page UI (ev_116a268f…)
- A single `textarea` with the placeholder "Type your question or paste an image".
- An image upload control, `input type=file`.
- A **Solve** button and a **New question** button.
- Sign up and Log in buttons, plus a collapsible nav.

### Network (anonymous load)
- **First-party API host:** `api-web.solvely.ai`
  - `GET /experiments/browser-payload`
  - `GET /experiments/resolve-safe` (and `?cold=1`)
  - `POST /pricing/ai-writing/offer`
- **Same-origin data:**
  - `/<route>/_payload.json`
  - `/_i18n/<hash>/en/messages.json`
  - `/solvely-web-pages-assets/builds/meta/<uuid>.json`
  - static assets under `/web-static-landing/`
- **Third-party:**
  - Firebase (web config and installations)
  - Google Identity Services (`accounts.google.com/gsi`)
  - PostHog
  - GA4, Google Ads and DoubleClick
  - Microsoft Clarity
  - Bing UET
  - Adjust
- **Console:** only errors from Google sign-in (FedCM) failing because no one was signed in. There were no page errors.

### Client storage (names only)
- **localStorage:** `webAnonDeviceId`, `solvely:exp-sdk:v1:*`, `solvelyWebExperiment`, `web_experiment:<TEST>:ANON_*`, plus PostHog, Adjust and UET keys.
- **sessionStorage:** `solvelyLoginEntryContext`, `web_experiment_exposure:*`, plus PostHog keys.

## Inferences (not proven)
- **Framework:** `_payload.json` and `/_i18n/…/messages.json` are Nuxt 3 conventions, which suggests a Nuxt 3 SSR/SSG site with i18n.
- **Auth:** Firebase Auth with Google One Tap / GSI.
- **Experiments:** an in-house A/B experiment SDK keyed on an anonymous device ID, with PostHog for analytics.
- **SEO strategy:** many thin tool landing pages, all sharing one solver widget.

## Unknowns
- The solve request: endpoint, payload, streaming or not, and the OCR/LLM provider. All of it sits behind clicking Solve, which we didn't do.
- Logged-in app routes, paywall and quota logic, and pricing amounts.

## Proposed architecture for our app
- **Frontend:** Next.js (App Router) + Tailwind.
- **Pages:**
  - `/` (landing)
  - `/solve` (one shared solver widget: textarea, image upload, Solve and New question)
  - `/tools/[slug]`, which reuses the widget with a different preset prompt
  - `/pricing`
- **API:** a Next route `POST /api/solve` that takes `{text?, image?}`.
  - It calls Claude (`claude-sonnet-5-5`, vision for images) and streams back a step-by-step answer in Markdown + KaTeX.
- **Auth/quota:** later. Start with an anonymous device ID in localStorage and a per-IP rate limit.
- **Skip for v1:** i18n, the experiments SDK, ad and analytics pixels, the mobile app, the extension, the writing tools and calculators.

# Supplied APK: static analysis (REA + JADX headless 0.7.1)
File: `apk/uptodown-com.solvely.photo.math.solver.calculator.ai.apk`, SHA-256 `dc885921fc2d141a53906675bd555f6f5d3705119f37f892d3edf3e61b342550`. REA CLI `rea-agents@6.7.0`, `inspect-android-package` Evidence `ev_0034e7d7950ce9e7f209e9b3f1b846234bee0eb959d7ef9296920e8ee94143c7`. Static only: the APK was never installed or run.

## Observations
- The manifest says **`package="com.uptodown"`**, versionName 7.41 (code 741), minSdk 23, targetSdk 36. That is the Uptodown app store client, **not Solvely** (Solvely's package should be `com.solvely.photo.math.solver.calculator.ai`).
- It has 13,961 classes and 2,169 resources. In the class inventory (8,746 named classes), the app code is `com.uptodown.*` (109 classes). The rest is libraries: androidx/Compose, Google, InMobi ads, mikepenz, davemorrissey.
- No class matches `solvely`/`Solvely`. The only "solver"/"math" hits are library utilities such as `androidx.constraintlayout.core.SolverVariable` and `com.google.android.material.math.MathUtils`.
- Its permissions are the ones an installer/store needs: `REQUEST_INSTALL_PACKAGES`, `INSTALL_PACKAGES`, `QUERY_ALL_PACKAGES`, `MANAGE_EXTERNAL_STORAGE`, `ACCESS_SUPERUSER`, `RECORD_AUDIO`, `AD_ID`, and others.
- Hosts in the strings: Uptodown, InMobi, country.is, Firebase. **No Solvely API host.**

## Inferences
- The file name has the Solvely ID in it, but Uptodown's download page handed over its own store/installer app instead of the Solvely APK.

## Unknowns
- Solvely's Android API endpoints, request payloads, OCR/LLM provider and paywall logic. None of it is in this file.

## Next step
To get a real analysis, supply the genuine Solvely APK. For example, pull the base APK from your own device: `adb shell pm path com.solvely.photo.math.solver.calculator.ai`, then `adb pull <path>`. Then re-run `inspect-android-package` and `search-android-classes <apk> solvely`.

> The Uptodown section above is superseded by the genuine Solvely APK analysis below.

# Solvely 3.0.4 APK: static analysis (REA + JADX headless 0.7.1)
File: `apk/Solvely v3.0.4 (Premium).apk`, SHA-256 `7c56944391548983ae5c79ce10e58d02fadd6e3cdcddd8d87439038407f67051`. Package Evidence `ev_5645c091aedb3efdc087491ed4c092d231371fa3ff7a11862c14267005679a22`. Static only: the APK was never installed or run. The "(Premium)" in the name points to a third-party, possibly modded build, so the paywall code may have been changed. The network and solve architecture is still the original.

## Observations
- **Identity:** package `com.solvely.photo.math.solver.calculator.ai` 3.0.4 (versionCode 123). App code lives in `com.mathsolvenow.panda`. The build has 9 dex files.
- **Networking:** Retrofit with coroutine `suspend` methods on OkHttp. `ApiService` has 34 methods (ev_183e2bbd5cd8f2498…). `NetworkApi` builds both a normal client and an "encrypt" client (ev_4137f66ac…). There are header interceptors (`HeadInterceptor`, `V9HeaderInterceptor`) and DNS-over-HTTPS (`DoHConfig`).
- **Request signing** (`SignInterceptor.intercept`, ev_f3452beb…):
  - It builds a canonical string from the request and takes its lowercase MD5.
  - It sends the result as a sign header.
  - GET requests also get the sign plus a timestamp as query params. POST, PUT and PATCH get the sign in the body.
  - It logs the signed data at debug level.
- **Environments:** `NetEnvironment` has the values Local / gray / release (ev_c1862598…).
- **API hosts** (from dex strings):
  - `api.justsolvely.com`
  - `a-api.justsolvely.com`
  - `api-gray-{android,ios}.justsolvely.com`
  - `api-test[-android].justsolvely.com`
  - Speech-to-text runs on Cloud Run (`solvely-web-stt-server-android-*.us-west1.run.app`), with an `api/v1/stt-token` path.
  - Firebase email login.
- **Endpoints** (dex strings, all under `/solveNowServer`):
  - Solve:
    - `v9/question/solve`, `v9/question/reSolve`, `v9/question/model/solve`
    - `v10/question/solve`, `v10/question/resolve`, `v10/question/modelSolve`, `v10/question/status`
    - `v1/question/fast/references`
  - Image:
    - `v10/question/buildPreUploadUrl` (presigned PUT)
    - `question/questionScan/v1.0` (multipart)
    - `report/question/picture/cut/v1.0`
  - Follow-up:
    - `question/askMore/v1.0` (+ `/feedback`)
    - `question/AITutor/v1.2|v1.3`, `AITutorStatus`
    - `question/moreQuestionSolvelyClass/v1.0`
    - `question/checkQuestionComplete/v1.0`
  - Generated media:
    - `question/visuals/generator`
    - `question/html/video/generator`, `question/html/cover/generator`
  - Monetization:
    - `balance/coins*`, `balance/diamondBalance`
    - `consume/diamondRule`, `consume/commentRewards`, `consume/userPurchList`
    - `purch/verify`, `purch/buyDiamonds`, `purch/purchaseInfo/v2.0`
    - `sp/subscription/cancel|reactivate`
  - User:
    - `user/info/v1.1`, `user/userInfo`, `user/pushToken`, `user/feedback`, `user/feedbackImg`, `user/coinsInfo`, `user/coinsModel`
- **Streaming:**
  - `StreamConfig.isUseStream` and `getStreamSolveDetailData` return `SolveStreamInfo`.
  - `text/event-stream` is in the strings.
  - JPush is also present for pushing results.
- **Model picker** (`SolveAIModelConfig.availableModelTypes`, ev_a2776976…):
  - The options are Solvely, MultiModel (if enabled), GPT, Google and Claude.
  - `normalizeModelId` (ev_92ef7…) delegates to `MoreAIType`.
- **Ask payload** (`AskRequestData`, ev_f490fde9…): questionId, answerId, sessionId, deviceId, conversations, language/curLanguage, questionContent, plus an instruction field.
- **Bundled SDKs:** Facebook Audience Network, AppLovin/InMobi/Vungle/Bytedance/Unity ad mediation, Adjust attribution, Firebase. Math is rendered with `flutter_tex` (KaTeX/MathJax + JSXGraph).

## Inferences
- A solve likely runs in four steps:
  1. Upload the image through the presigned URL, or as a multipart scan.
  2. `v10/question/solve` with a model id.
  3. Poll `question/status`, or stream the answer over SSE.
  4. Follow-ups through `askMore` / `AITutor`.
- v9 and v10 are kept side by side so that older clients keep working.
- The MD5 sign depends on a secret embedded in the client. That stops casual replay, not a determined attacker.
- Solvely routes to third-party LLM vendors (GPT, Google and Claude), with its own "Solvely" default on top.

## Unknowns
- Which runtime base URL is used in release. `AppUrlConfig` is filled in at runtime, and its `<clinit>` failed to decompile.
- The exact sign salt and canonicalization order. These were deliberately not extracted.
- The streaming wire format. `SolveStreamHelper` was unreadable.
- `PurchaseInfoApiService` and `SpeechApiService` timed out. No traffic was observed.

## What StepWise takes from this (our own design, no code copied)
- Stream answers over SSE from `/api/solve`. We already do this.
- For photos, upload directly and keep the base64 body small. The presigned pattern is something to add later.
- An optional model picker. Ours lists Gnani Evon (default) and Gemini Flash for photos.
- A follow-up "ask more" endpoint keyed by session id.
- No client-side signing secret. Rate limiting stays on the server.
