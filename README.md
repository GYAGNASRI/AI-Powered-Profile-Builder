# AI Profile Generator

An AI-powered app that generates a structured public profile of an individual from just a **name + context**, grounded in real public sources with references.

Built on **TanStack Start** (React 19 + Vite) with **Lovable AI Gateway** (Google Gemini 3 Flash) and **Firecrawl** for public-web retrieval.

---

## Example

**Input:** `Satya Nadella` / `CEO of Microsoft`
**Output:** Executive summary, basic details, biography, career timeline, education, interests, estimated net worth, recent news, references, and a `Missing / Conflicts` section — see reference layout in `docs/sample.png`.

---

## Architecture — 4-Step Agentic Workflow

```text
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │  1. SEARCH   │──▶│  2. EXTRACT  │──▶│ 3. SYNTHESIZE│──▶│ 4. STRUCTURE │
 │              │   │              │   │              │   │              │
 │ Plan 6 web   │   │ LLM pulls    │   │ LLM writes   │   │ Curate refs, │
 │ queries →    │   │ basic facts, │   │ bio, timeline│   │ merge, flag  │
 │ Firecrawl →  │   │ flags gaps + │   │ education,   │   │ conflicts &  │
 │ dedupe URLs  │   │ conflicts    │   │ news, etc.   │   │ gaps         │
 └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

All steps run inside a single TanStack **server function** (`src/lib/profile.functions.ts`) and stream a live status list back to the UI.

**AI engineering approaches used**
- **Agent orchestration** — planner → retriever → extractor → synthesizer → structurer
- **Tool / function calling** — `firecrawlSearch` as a retrieval tool for the planner's queries
- **Multi-step retrieval + extraction** — 6 parallel searches, URL dedupe, priority-domain ranking (Wikipedia, Forbes, Bloomberg, Reuters, LinkedIn, Britannica, NYT, FT, CNBC)
- **Structured output** — Zod schemas + AI SDK `generateObject` (strict JSON)
- **Conflict/gap handling** — LLM emits `missingFields` and `conflictingFields`; UI surfaces them explicitly instead of fabricating
- **Robustness** — per-step try/catch, `NoObjectGeneratedError` fallback, gateway error surfacing, step-level logging

---

## Tech Stack

| Layer     | Choice                                                   |
|-----------|----------------------------------------------------------|
| Framework | TanStack Start (React 19, Vite 7)                        |
| AI Model  | `google/gemini-3-flash-preview` via Lovable AI Gateway   |
| AI SDK    | Vercel AI SDK + `@ai-sdk/openai-compatible`              |
| Retrieval | Firecrawl v2 (via Lovable connector gateway)             |
| Schema    | Zod                                                      |
| UI        | Tailwind v4 + shadcn/ui                                  |

---

## Setup

Prerequisites: Bun (or Node 20+).

```bash
bun install
bun dev
```

**Environment variables** (auto-provisioned in Lovable; set manually for local dev):

| Variable            | Purpose                                          |
|---------------------|--------------------------------------------------|
| `LOVABLE_API_KEY`   | Auth for Lovable AI Gateway + connector gateway  |
| `FIRECRAWL_API_KEY` | Firecrawl connection key (via Firecrawl connector) |

Both are server-only and read inside server-function handlers — never exposed to the browser.

---

## File Map

```
src/
├── routes/index.tsx              # Form + ProfileView + WorkflowProgress
├── lib/
│   ├── profile.functions.ts      # 4-step orchestrator (server function)
│   ├── ai-gateway.server.ts      # Lovable AI Gateway provider (AI SDK)
│   └── firecrawl.server.ts       # Firecrawl v2 client (gateway-backed)
└── styles.css                    # Design tokens
```

---

## How Missing / Conflicting Info Is Handled

- Extractor is instructed to **never fabricate** — unknown string fields are set to `null`.
- Every field it could not confidently determine is added to `missingFields`.
- Any cross-source contradiction is described in `conflictingFields`.
- The final profile exposes a `Missing / Conflicts` panel in the UI so the reader can see exactly what is unknown or disputed.

---

## Reproducibility

1. Open the app
2. Enter `Satya Nadella` / `CEO of Microsoft`
3. Click **Generate Profile**
4. Watch the 4-step workflow progress, then read the generated profile with clickable source links.
