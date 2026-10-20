# StepWise

AI homework helper: type or paste a photo of a problem and get a step-by-step solution.

Built on **Gnani Evon v3.3** (`gnani/gnani-evon-v3.3-30B-A3B`) for solving, with **Google Gemini Flash** reading photos into text first (Evon is text-only).

## Run

1. `npm install`
2. Serve Evon through an OpenAI-compatible endpoint, for example `vllm serve gnani/gnani-evon-v3.3-30B-A3B` (GPU), or a quantized build in Ollama / LM Studio.
3. Copy `.env.example` to `.env.local`, then set `GEMINI_API_KEY`, `EVON_BASE_URL` and `EVON_MODEL`.
4. `npm run dev` and open http://localhost:3000

`npm test` checks request validation and stream parsing. Design notes on the reference app are in `FINDINGS.md`.

Before a public deploy, add rate limiting to `app/api/solve/route.js`.
