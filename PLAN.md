# Videofy — Development Plan

## Status: Pre-implementation planning document
**Last updated:** 2026-04-02  
**Repo:** https://github.com/roblangTR/videofy

---

## Current Sprint: Two Core Changes

### Sprint Goal
1. Add **captioned video mode** (silent, text-on-screen, no voiceover)
2. Replace **OpenAI direct API calls** with **Open Arena API** (Thomson Reuters internal LLM gateway)

---

## Change 1: Captioned Video Mode

### Background
Captioned news video (also called silent video, social video, or text-on-screen video) is a pre-packaged video format designed to be watched without sound. On-screen text captions carry the narrative of the story rather than a voiceover. The format emerged from social media autoplay contexts (Facebook, news apps) where video plays silently by default.

Key characteristics:
- Captions are **editorial, not transcriptive** — they tell the story, not describe what you hear
- **Visual rhythm follows the text** — shot cuts are timed to caption beats
- No reporter voiceover, no ElevenLabs TTS
- Designed for **autoplay without audio**

### What Changes

#### `api/schemas.py`
- Add `videoMode: Literal["narrated", "captioned"] = "narrated"` to `GenerationManifestOptions`
- Add `videoMode: Literal["narrated", "captioned"] | None = None` to `ProcessRequest` (None = read from manifest)
- Backward compatible: existing projects without videoMode default to `"narrated"`

#### `api/config_resolver.py` + `ResolvedConfig`
- Expose `captioned_script_prompt: str` — separate, shorter English-language prompt for captioned scripts
- Expose `caption_timing: dict` — configurable display durations

#### `brands/default.json`
Add to `prompts`:
```json
"captionedScriptPrompt": "You are writing on-screen captions for a silent news video to be played on social media feeds and digital signage screens. You will receive a news article. Write 3-5 short caption cards that tell the story editorially. Rules: (1) Each caption must stand alone as a complete thought. (2) Maximum 10 words per caption — aim for 7-8. (3) Use simple, direct language. (4) Lead with the most newsworthy information. (5) The final caption should provide resolution or context. (6) Do NOT use a welcome message, byline, or padding. Return JSON with a 'lines' array of strings."
```

Add `captionTiming` section:
```json
"captionTiming": {
  "minDisplaySeconds": 2.5,
  "maxDisplaySeconds": 5.0,
  "secondsPerWord": 0.35,
  "transitionSeconds": 0.3
}
```

#### `api/pipeline.py`
In `process_manuscript()`:

**Narrated mode (existing behaviour):**
1. Resolve config
2. Load manuscript
3. Synthesize TTS per line (ElevenLabs) → get audio duration per line
4. Set `text_line.start` / `text_line.end` from audio durations
5. Concatenate audio → `output/narration.mp3`
6. Set `meta.audio = { "src": "<url>" }`

**Captioned mode (new):**
1. Resolve config
2. Load manuscript
3. **Skip TTS entirely** — calculate display timing from word count:
   - Per line: `max(min_secs, min(max_secs, word_count * seconds_per_word))`
   - Add `transition_seconds` gap between segments
   - Set `text_line.start` / `text_line.end` from calculated durations
4. **Skip narration concatenation**
5. Set `meta.audio = {}` — empty = no audio track
6. Save processed manuscript

In `generate_manuscript()`:
- If `videoMode == "captioned"` in manifest options, use `captioned_script_prompt` instead of `script_prompt`

#### `cms/src/state/globalState.ts`
- Add `videoMode: "narrated" | "captioned"` to `StoreState`, default `"narrated"`
- Add setter

#### `cms/src/components/StartPage/StartPage.tsx`
- Add mode selector (radio or toggle): **Narrated** / **Captioned**
- Write choice to generation manifest when creating a new project

#### `cms/src/components/EditPage/EditConfig.tsx`
- Show/hide audio-related controls based on `videoMode`
- When captioned: hide voice/audio recorder sections

#### `cms/src/utils/processManuscript.ts`
- Pass `videoMode` from global state in the process request body

#### `types/src/manuscript.types.ts`
- No change needed — `meta.audio` being empty already signals silent video to the player

#### `player/src/Sequence/Assets/BackgroundMusic.tsx`
- Guard: only mount if `meta.audio?.src` is present

#### `player/src/ArticlesSeries.tsx`
- Guard narration audio component on `meta.audio?.src` presence

---

## Change 2: OpenAI → Open Arena API

### Background
Open Arena is Thomson Reuters' internal LLM gateway providing access to models (GPT-4.1, Gemini, etc.) through a workflow/chain-based inference API with ESSO authentication. The API supports both text inference and file uploads (V3 pre-signed S3 pattern).

There are **three distinct AI calls** to replace, each getting its own configurable workflow ID.

### The Three Call Types

| Call | Workflow Env Var | API Pattern | Notes |
|------|-----------------|-------------|-------|
| Script generation | `OA_WORKFLOW_SCRIPT_ID` | Text inference (`/v3/inference`) | Article text → 3-5 caption lines |
| Image/video description | `OA_WORKFLOW_DESCRIBE_ID` | File upload (`/v3/document/file_upload`) + inference | Image → description text (vision) |
| Asset placement | `OA_WORKFLOW_PLACEMENT_ID` | Text inference (`/v3/inference`) | Script lines + descriptions → asset-to-line mapping |

### Open Arena API Patterns Used

**Text inference (`POST /v3/inference`):**
```json
{
  "workflow_id": "<id>",
  "query": "<user message>",
  "is_persistence_allowed": false,
  "conversation_id": null,
  "modelparams": {
    "<component_id>": {
      "system_prompt": "<system instructions>"
    }
  }
}
```
Response: `result.answer.<component_key>` → free-text string

**File upload (V3 two-step):**
```
Step 1: POST /v3/document/file_upload
  Body: { files_names: [{ file_name, file_id }], workflow_id, is_rag_storage_request: false }
  Returns: url[0].url.url (S3 pre-signed URL), url[0].url.fields, url[0].url.file_name

Step 2: POST to S3 URL
  multipart: fields + file bytes

Returns: final_file_name (timestamped)
```

**File-context inference:**
```json
{
  "workflow_id": "<id>",
  "query": "<user message>",
  "is_persistence_allowed": false,
  "context": { "input_type": "file_uuid", "value": ["<final_file_name>"] }
}
```

**Response parsing:**
- OA returns free-text answers (not structured output like OpenAI's `responses.parse()`)
- Must parse JSON from free-text using:
  1. Try `json.loads()` directly
  2. Extract from markdown code fences (` ```json ... ``` `)
  3. Scan for first `[` or `{` and raw-decode
  4. Log warning + use fallback on failure

**Retry strategy:**
- Retryable status codes: `408, 429, 500, 502, 503, 504`
- Max 3 attempts, exponential backoff (1.5s base)
- V3 → V2 fallback if V3 returns 404/405/501

### New File: `api/oa_service.py`

Single service class handling all three call types:

```python
class OAService:
    def __init__(self, esso_token, base_url, component_id,
                 script_workflow_id, describe_workflow_id, placement_workflow_id,
                 ffprobe_bin)

    def summarize_into_lines(self, text, title, system_prompt, model_override=None) -> list[str]
        # Script generation call — replaces LLMService.summarize_into_lines()
        # Sends JSON { title, text } as query, system_prompt via modelparams
        # Parses JSON with lines: list[str] from free-text response

    def describe_image(self, image_path, asset_metadata, describe_prompt) -> str
        # Image/video frame description — replaces _describe_image_path() in asset_analysis.py
        # Step 1: Upload image to OA V3
        # Step 2: Inference with file context
        # Parses description: str from free-text response

    def assign_assets_to_lines(self, script_lines, candidate_assets, placement_prompt) -> list[str]
        # Asset placement — replaces _openai_assign_assets_to_script_lines() in asset_analysis.py
        # Sends numbered list of lines + assets as query
        # Parses asset_ids: list[str] from free-text response

    def _upload_image(self, image_path, workflow_id) -> str
        # V3 two-step upload; returns final_file_name

    def _infer(self, workflow_id, query, system_prompt=None, file_name=None) -> str
        # Core inference call with retry logic

    def _extract_json(self, raw_text) -> Any
        # JSON extraction from free-text (direct, fenced, scan)
```

### Settings Changes: `api/settings.py`

**Remove:**
```python
openai_api_key: str = ""
openai_model: str = "gpt-4o-mini"
```

**Add:**
```python
oa_esso_token: str = ""
oa_base_url: str = "https://aiopenarena.gcs.int.thomsonreuters.com"
oa_component_id: str = "openai_gpt-41"  # Component key for modelparams
oa_workflow_script_id: str = ""          # Script generation workflow
oa_workflow_describe_id: str = ""        # Image description workflow (vision)
oa_workflow_placement_id: str = ""       # Asset placement workflow
```

Note: `OPENAI_API_KEY` in `AssetAnalysisService` is also removed; image description goes through `OAService`.

### Files Deleted
- `api/llm_service.py` — replaced by `OAService.summarize_into_lines()`

### `.env.example` Changes

**Remove:**
```
OPENAI_API_KEY=
```

**Add:**
```
OA_ESSO_TOKEN=
OA_BASE_URL=https://aiopenarena.gcs.int.thomsonreuters.com
OA_COMPONENT_ID=openai_gpt-41
OA_WORKFLOW_SCRIPT_ID=
OA_WORKFLOW_DESCRIBE_ID=
OA_WORKFLOW_PLACEMENT_ID=
```

### Factory Changes: `api/factory.py`

Replace:
```python
llm = LLMService(api_key=settings.openai_api_key, model=settings.openai_model)
```

With:
```python
oa_service = OAService(
    esso_token=settings.oa_esso_token,
    base_url=settings.oa_base_url,
    component_id=settings.oa_component_id,
    script_workflow_id=settings.oa_workflow_script_id,
    describe_workflow_id=settings.oa_workflow_describe_id,
    placement_workflow_id=settings.oa_workflow_placement_id,
    ffprobe_bin=settings.ffprobe_bin,
)
```

Remove `openai_api_key` from `AssetAnalysisService` constructor.

---

## Implementation Order

```
Phase 1: Backend
  1. api/oa_service.py                   — new OA service (upload + inference)
  2. api/settings.py                     — swap env vars
  3. api/schemas.py                      — add videoMode to options + process request
  4. api/config_resolver.py              — expose captionedScriptPrompt + captionTiming
  5. api/factory.py                      — wire OAService, remove LLMService/OpenAI
  6. api/pipeline.py                     — use OAService + captioned timing branch
  7. api/asset_analysis.py               — use OAService for describe + placement
  8. api/llm_service.py                  — DELETE

Phase 2: Config
  9. brands/default.json                 — add captionedScriptPrompt + captionTiming (English)
 10. .env.example                        — update env vars

Phase 3: CMS Frontend
 11. cms/src/state/globalState.ts        — add videoMode state
 12. cms/src/components/StartPage/       — add narrated/captioned selector
 13. cms/src/components/EditPage/        — conditional audio controls
 14. cms/src/utils/processManuscript.ts  — pass videoMode in process request

Phase 4: Player
 15. player/src/                         — guard audio components on meta.audio?.src

Phase 5: Tests & Docs
 16. tests/                              — update + add captioned mode tests
 17. README.md                           — document new env vars + captioned mode
 18. git commit + push
```

---

## Backlog: Other Improvements Identified in Code Review

These are improvements identified during the initial code review. They are not part of the current sprint but should be tracked and addressed.

### Priority 1 — Bugs / Correctness

**1.1 Web fetcher hardcoded brandId**
- **File:** `fetchers/web/fetcher.py` line 917
- **Problem:** `build_generation_manifest()` hardcodes `"brandId": "vg"` and `"promptPack": "vg"` — a leftover from the internal VG (Norwegian newspaper) build. New projects created via the web fetcher will silently fail if there's no `brands/vg.json`.
- **Fix:** Change to `"brandId": "default"`, `"promptPack": "default"`, `"voicePack": "default"`.

**1.2 Main.tsx renders `<html>/<body>` inside a client component**
- **File:** `cms/src/app/Main.tsx`
- **Problem:** `<html>` and `<body>` tags are rendered inside `Main`, which is a `"use client"` component. In Next.js App Router, these must live in `layout.tsx` (a Server Component). This causes hydration mismatches and double-wrapped DOM nodes.
- **Fix:** Move `<html lang="en">` and `<body>` to `cms/src/app/layout.tsx`, keep only the Ant Design providers in `Main.tsx`.

**1.3 TTS import compatibility shim is a no-op**
- **File:** `api/tts_service.py` lines 8-13
- **Problem:** The `try/except ImportError` block imports `VoiceSettings` and `ElevenLabs` identically in both branches. The fallback does nothing different, so any real import error would still bubble up.
- **Fix:** Remove the try/except and import directly.

### Priority 2 — Reliability / Resilience

**2.1 No retry logic on AI API calls**
- **Files:** `api/llm_service.py` (→ `api/oa_service.py` will have retries), `api/tts_service.py`
- **Problem:** ElevenLabs TTS calls have no retry/backoff. Both services regularly return transient 429/500/503 errors.
- **Fix:** Wrap ElevenLabs `synthesize_line()` with exponential backoff (3 attempts, 1.5s base). The new `OAService` will include retries by design.

**2.2 Subprocess calls without timeouts**
- **Files:** `api/tts_service.py` (concat_mp3, create_silence_mp3), `api/asset_analysis.py` (ffmpeg frame extraction)
- **Problem:** All `subprocess.run()` calls lack `timeout=`. A hung or stalled ffmpeg process blocks the API thread indefinitely with no recovery path.
- **Fix:** Add `timeout=120` (configurable) to all ffmpeg/ffprobe `subprocess.run()` calls.

**2.3 File upload with no size limit**
- **File:** `api/api.py` lines 43-44
- **Problem:** `file.file.read()` reads the entire upload into memory with no size cap. A 500MB upload would exhaust RAM.
- **Fix:** Add a configurable `max_upload_bytes` setting (default 50MB). Check `Content-Length` header and reject before reading, or use streaming read with byte counter.

**2.4 Bare `except Exception` swallows TTS voice settings errors**
- **File:** `api/tts_service.py` line 47
- **Problem:** `VoiceSettings(**voice_settings)` is wrapped in a bare `except Exception` that falls back to the raw dict silently. Validation errors in voice settings are invisible.
- **Fix:** Catch only `TypeError` / `ValidationError` and log a warning with the error message before falling back.

### Priority 3 — Type Safety / Schema Consistency

**3.1 Data model defined in three places**
- **Files:** `api/schemas.py` (Pydantic), `types/src/manuscript.types.ts` (Zod), `cms/src/state/globalState.ts` (inferred Zod type)
- **Problem:** The manuscript/segment data model is defined independently in Python and TypeScript and can drift. Known discrepancies:
  - `Segment.images` in Python accepts `list[MediaAssetImage | MediaAssetVideo]`; TypeScript's `segmentSchema.images` also accepts `mapSchema` (not present in Python)
  - Python `ManuscriptMeta` has `description` and `audio` fields not validated in TypeScript `manuscriptSchema.meta`
  - TypeScript `textSchema` doesn't validate `start`, `end`, `displayText`, `who` fields that exist in Python `TextLine`
- **Fix (medium-term):** Generate Python Pydantic models from the Zod schemas (or vice versa) using a code generation step, or at minimum add a CI check that runs both Python tests and TypeScript `check-types` and fails on inconsistency.
- **Fix (short-term):** Document the known gaps, add comments pointing to the counterpart, fix the specific `mapSchema` discrepancy.

**3.2 Zustand global state initialised with `null!` casts**
- **File:** `cms/src/state/globalState.ts`
- **Problem:** `config`, `currentTab`, `currentTabIndex` are initialised as `null! as ApiConfig` etc. Any component that reads these before they're set will throw a runtime error that TypeScript doesn't catch.
- **Fix:** Make these `undefined` (nullable) and add null guards in consuming components, or use a "not yet loaded" sentinel state.

### Priority 4 — Code Quality / Maintainability

**4.1 `asset_analysis.py` is too large (1038 lines)**
- **Problem:** `AssetAnalysisService` handles image description via OpenAI Vision, video keyframe extraction, scene detection, hotspot inference, and asset-to-script placement. Very hard to test in isolation.
- **Fix:** Split into separate service classes:
  - `MediaDescriptionService` — image/video description
  - `PlacementService` — asset-to-script assignment
  - `HotspotService` — hotspot prediction (already partially separated via `hotspot_worker.py`)
  - `AssetAnalysisService` — orchestrator only

**4.2 `fetchers/web/fetcher.py` is too large (1156 lines)**
- **Problem:** HTML parsing, JSON-LD extraction, media downloading, project creation, and CLI argument parsing all in one file.
- **Fix:** Split into:
  - `_parser.py` — `HTMLParser` subclass and helpers
  - `_extract.py` — JSON-LD parsing, title/byline/pubdate/text/media extraction
  - `_download.py` — binary media download helpers
  - `fetcher.py` — entry point: orchestration + CLI only (~100 lines)

**4.3 Four drag-and-drop libraries**
- **File:** `cms/package.json`
- **Problem:** `@dnd-kit/core`, `@dnd-kit/sortable`, `react-drag-listview`, `react-easy-sort`, and `react-movable` are all installed — five packages for the same concern.
- **Fix:** Audit which components use which library. Consolidate to `@dnd-kit` (the most feature-complete). Remove unused packages.

### Priority 5 — Performance / API Design

**5.1 No async API endpoints**
- **Files:** `api/api.py`
- **Problem:** All FastAPI endpoints are synchronous (`def` not `async def`). The pipeline operations (LLM calls, TTS synthesis) are blocking and hold a thread pool worker for 30-60+ seconds per request. This severely limits concurrency.
- **Fix (short-term):** Run pipeline operations in `asyncio.get_event_loop().run_in_executor()` to avoid blocking the event loop.
- **Fix (medium-term):** Convert `generate_manuscript()` and `process_manuscript()` to async, use `asyncio` / `httpx` for AI calls.

**5.2 No progress reporting for long operations**
- **Problem:** `generate_manuscript()` and `process_manuscript()` take 30-120+ seconds with no progress feedback to the CMS. The UI has no way to show progress.
- **Fix:** Add a simple Server-Sent Events (SSE) endpoint `GET /api/projects/{project_id}/status` that the CMS can poll or subscribe to, with status messages like `"step": "3/7 - Running asset analysis"`.

**5.3 Pipeline operations run synchronously from HTTP thread**
- **Problem:** A single long-running generation blocks the FastAPI thread pool. If multiple users run generation simultaneously, the API becomes unresponsive.
- **Fix (medium-term):** Move pipeline work to a background task queue (e.g., Celery + Redis, or Python's built-in `asyncio.create_task`). The endpoint immediately returns a job ID; the client polls for completion.

### Priority 6 — Security

**6.1 File serving without path traversal protection**
- **File:** `api/api.py` lines 170-176, `api/project_store.py` `resolve_asset_path()`
- **Problem:** The `project_file` endpoint serves arbitrary paths under a project directory. Must verify the resolved path stays within the project root.
- **Status:** `ProjectStore.resolve_asset_path()` should be checked to confirm it validates the resolved path is under `projects/<projectId>/`. If not, add an explicit check.
- **Fix:** In `resolve_asset_path()`, after resolving, assert `str(resolved_path).startswith(str(self.root))`.

**6.2 No API authentication**
- **Problem:** The FastAPI API has no auth middleware. Anyone on the same network can call any endpoint. In Docker Compose, the API binds to `0.0.0.0:8001`.
- **Status:** Acceptable for local dev; should not be deployed to shared infrastructure without auth.
- **Fix (when deploying):** Add a simple API key middleware or integrate with ESSO.

**6.3 CORS allows all methods**
- **File:** `api/factory.py` line 63
- **Problem:** `allow_methods=["*"]` allows DELETE, PUT, PATCH etc. from any of the CORS-allowed origins.
- **Fix:** Restrict to `["GET", "POST"]` unless specific methods are needed.

### Priority 7 — Testing

**7.1 No frontend tests**
- **Problem:** Zero test files for the CMS (`cms/`) or Player (`player/`). No Jest or Vitest configuration.
- **Fix:** Add Vitest (compatible with Next.js) with at minimum:
  - Unit tests for `globalState.ts` (state mutations)
  - Unit tests for `processManuscript.ts` and `generateManuscript.ts` (API call construction)
  - Unit tests for `configResolver.ts` (config merging)

**7.2 `test_cms` only runs typecheck + build**
- **File:** `Makefile` line 96
- **Problem:** `make test-cms` runs `tsc --noEmit` and `next build`. It doesn't run any actual test assertions.
- **Fix:** Add `vitest run` once frontend tests exist.

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-02 | Use Open Arena API for all three LLM call types | TR internal policy; direct OpenAI not preferred |
| 2026-04-02 | Three separate OA workflow IDs | Each call type may need different model/parameters |
| 2026-04-02 | Keep ElevenLabs for narrated mode | No TR equivalent for TTS |
| 2026-04-02 | English for captioned script prompt | More universally useful as a default |
| 2026-04-02 | Single-commit port to roblangTR/videofy | Clean history; no need to preserve Schibsted commit log |
