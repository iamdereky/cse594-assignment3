# Calorie Lens — Assignment 3

Assignment 3 is an independent copy of `../cse594-assignment1`; the original is unchanged. It uses the Assignment 2 CSV and all **458** matching meal images supplied in this workspace. Each participant receives **10** random meals per condition, without replacement. No model or external AI API runs during participation.

## Architecture and reused code

Assignment 1 uses Next.js App Router, React, TypeScript, route-handler APIs, Zod validation, and Supabase Postgres. Username registration creates a `users` record, then issues a random opaque session token; only its hash is stored in `sessions`. A secure HTTP-only cookie identifies subsequent requests. Assignment 1 selects five tweets through `start_assignments`, saves labels through `submit_assignment_label`, and deploys as a single Next.js app on Vercel with Supabase as its external database.

Assignment 3 reuses `app/api/auth/*`, `lib/session.ts`, `lib/security.ts`, `lib/http.ts`, `lib/supabase-admin.ts`, the username validation, login layout, shared CSS palette/panels/typography, Next.js configuration, and deployment structure. Its cookie is named `calorie_study_session` to avoid overlapping the original study’s cookie. Legacy emotion routes, components, tests, migrations, and seed remain in the copy but are not part of the calorie study flow.

The implementation adds these focused pieces:

- `components/calorie-study.tsx`: shared instructions, attention check, meal task, optional assistant, confidence rating, and completion components.
- `app/study/[condition]/page.tsx`: validates the two condition URLs.
- `app/api/study/[condition]/route.ts`: authenticated GET and POST actions (`attention`, `start`, `consult`, `submit`).
- `lib/calorie-config.ts`: `NUM_TRIALS`, conditions, and browser-safe view types.
- `lib/calorie-validation.ts`: server input validation.
- `lib/calorie-study.ts`: `loadStudyTrials()` reads assigned meals and explicitly projects safe browser data. Neither ground truth nor model errors are returned. Model predictions are fetched only after a persisted consultation in the AI condition.
- `scripts/import_dataset.py`: one CSV/ingredient parsing and image-validation boundary; generates `supabase/calorie_seed.sql`.
- `supabase/migrations/003_calorie_study.sql`: additive tables, transactional action function, and researcher-only analysis view.
- `tests/calorie*.{ts,sql}`: UI, data exposure, validation, and database regression coverage.

The database follows the original normalized convention: responses reference an immutable meal trial rather than duplicating reference calories in every response. `calorie_analysis_records` joins these references into a flat export for analysis. This leaves the original tables intact and avoids inconsistent copies of model/ground-truth values. Keep reference rows unchanged once collection begins.

## Setup and run

Prerequisites: Node.js 20.19+ (or Node.js 22.12+), npm, Python 3, and a Supabase project. The frontend and backend run together; there is no separate backend process.

```bash
cd cse594-assignment3
npm ci
cp .env.example .env.local
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Use the server-only service-role key; never prefix it with `NEXT_PUBLIC_`.

For a **new Supabase project**, run these SQL files in the SQL Editor, in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_username_only_access.sql`
3. `supabase/migrations/003_calorie_study.sql`
4. `supabase/calorie_seed.sql`

For a database already running Assignment 1’s migrations, run **only 003 and calorie_seed.sql**. Do not rerun 001 against an existing schema. `supabase/seed.sql` is the preserved emotion-task seed and is not needed for the calorie study.

Alternatively, with a direct database connection available:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/001_initial_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/002_username_only_access.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/003_calorie_study.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/calorie_seed.sql
npm run dev
```

Open:

- No AI: `http://localhost:3000/study/no-ai`
- Optional AI assistance: `http://localhost:3000/study/ai`

Each URL redirects signed-out participants to the shared login and preserves their condition after registration/sign-in. Use the same private username to resume. Each username has one persistent run per condition; refreshing or signing in again does not redraw the sample. Meals assigned in the participant’s other condition are excluded too. The researcher should distribute the intended condition link; there is no automatic randomized condition allocation.

For a production build:

```bash
npm run build
npm start
```

For Vercel, import **the `cse594-assignment3` folder as the project root**, set both Supabase environment variables, and deploy using the default Next.js configuration. The CSV stays under private `data/`; only the images are under `public/`. Include `public/study_images` in the deployment. No storage bucket is required.

## Dataset and configuration

Data and images are already copied to:

- `data/study_dataset.csv`
- `public/study_images/*.jpg`

The original files in the parent workspace are unchanged. To import a replacement dataset, put its CSV and images in those same locations, then run:

```bash
python3 scripts/import_dataset.py
```

Run the newly generated `supabase/calorie_seed.sql` in Supabase. The importer validates the entire pool; it never reduces it to `NUM_TRIALS`. Existing trial IDs are left untouched on reimport. A changed study dataset should use a fresh database/project or explicitly versioned new IDs and image filenames; do not overwrite reference values or images during data collection.

Required CSV columns:

| Column | Meaning |
| --- | --- |
| `trial_id` | Unique, nonempty trial identifier |
| `dish_id` | Unique, nonempty meal identifier |
| `image_path` | Image filename or path; importer uses the basename to resolve `public/study_images` |
| `ground_truth_kcal` | Finite non-negative reference calories, private to the server |
| `model_total_kcal` | Finite non-negative precomputed AI total |
| `model_ingredients_json` | JSON array of objects with `name`, non-negative `kcal`, and optional non-negative `grams` |

Extra columns, including errors and raw model output, are ignored. JSON is parsed at import time, not inside UI components. Original Colab absolute paths work because filenames match the supplied local images. Ingredient confidence is not shown.

Optional importer paths:

```bash
python3 scripts/import_dataset.py --csv /path/to/study.csv --images /path/to/images --output /path/to/seed.sql
```

Change **`NUM_TRIALS` in `lib/calorie-config.ts`** and restart/redeploy. Existing runs retain the count recorded when they first attempted the attention check. The pool must contain enough unseen meals for the participant; insufficient data fails transactionally rather than silently creating a shorter run.

## Collection and stored fields

`calorie_runs` stores participant ID, study-session ID, condition, creation/start/completion times, first attention-check result, number of attempts, pass state, and assigned trial count. Wrong answers can be retried after reviewing the instructions.

`calorie_responses` stores assignment ID, run ID, exact trial ID, position, trial start/end times, duration in milliseconds, first AI-consultation timestamp, initial estimate, final estimate, confidence (1–5), and `consulted_ai` derived from the timestamp. `meal_trials` retains dish ID, reference calories, model total, and parsed ingredients. `calorie_analysis_records` combines these with the participant ID and condition for researcher export. It is not exposed through a participant endpoint.

Timing begins on the first successful meal-image load acknowledgment and ends on server receipt of submission. It includes consultation, network latency, and time spent away from the page. Refreshing retains the first start time. This measures elapsed trial time, not active viewing time, and there is no countdown. Unsaved calorie/confidence drafts are not restored after refresh; saved consultation history and completed responses are preserved. On return after consultation, the captured initial estimate pre-fills the input for convenience.

Consulting sends the current valid estimate or null. The database records this value and the timestamp only once, before returning predictions. A repeated click or retried consultation cannot overwrite either field. A consultation is never required for submission. No-AI responses always retain null consultation/initial values. A lost consultation response may leave a consultation recorded even if the panel did not reach the browser; the stored timestamp measures the request accepted by the server, not proof that the participant read the panel.

The numeric input accepts zero and any finite non-negative value, with no narrow calorie ceiling. Confidence is required. Client controls, server validation, database constraints, row locks, and idempotent submission prevent accidental double submission and response overwrites. Ground truth, errors, and correctness feedback never appear during participation. Completion has no questionnaire or public results table.

To inspect/export completed records from the Supabase SQL Editor:

```sql
select * from public.calorie_analysis_records
where trial_ended_at is not null
order by participant_id, condition, position;
```

Username access remains the lightweight Assignment 1 convention: a returning participant uses the same private username. Anyone who knows that username can resume that account. Supabase tables have row-level security, no browser-role access, and service-role access only through the server.

## Verification and manual checklist

```bash
npm test
npm run build
# Against a disposable test DB with the migrations and calorie seed loaded:
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/calorie-database.sql
```

The SQL regression test rolls back its test participants and responses. It exercises two full 10-trial runs, wrong/correct attention attempts, cross-condition meal exclusion, ownership, sequential order, no-AI consultation rejection, first consultation with and without an estimate, duplicate consultation/submission, validation, timing, completion, permissions, and all analysis fields. The automated React tests exercise both flows with simulated API responses; projection tests check that reference values never reach participants.

Manual checks after connecting your Supabase project:

1. Open `/study/no-ai`, create a test username, review instructions, choose a wrong attention answer, then retry correctly.
2. Confirm the meal loads, confidence has five choices, no assistant is visible, and empty/negative calories or missing confidence cannot submit.
3. Complete all meals; confirm progress advances once per submission, no meal repeats, no correct answer appears, and completion only thanks the participant.
4. Open `/study/ai`. Enter `600`, consult, verify total and ingredient calories/grams, change to `720`, choose confidence, and submit. Also try one trial consulting before entering calories and one without consulting.
5. Refresh during a trial and sign out/in; confirm the assigned meal and saved consultation remain. Rapidly click submit; confirm only one response is stored.
6. Inspect `calorie_analysis_records`: the first consultation example must have initial `600`, final `720`, consultation true, and timestamps; consultation before entry must have null initial; unconsulted trials must have false/null consultation fields. Check confidence, duration, exact IDs, reference calories, and run completion time.
7. Check browser Network responses: no ground truth or error columns; no predictions in no-AI or before consultation. Repeat both routes on a narrow/mobile viewport and confirm each image and all controls remain usable.

Local verification completed during implementation: all 25 tests passed, the production build passed, and both complete 10-trial database flows passed on a temporary Postgres 17 database seeded with all 458 meals. Live Supabase/Vercel testing still requires your project credentials; no hosted database or production deployment was changed.

Dependency maintenance in this copy updated Next.js/its ESLint config to 16.4.5, Zod to 4.6.7, Vitest to 5.1.0, and compatible transitive packages. The final audit retained eight moderate development-tool findings through the ESLint/minimatch dependency chain; no high or critical findings remained. The original Assignment 1 dependency files were not changed.
