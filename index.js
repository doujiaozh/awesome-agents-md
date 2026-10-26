#!/usr/bin/env node
'use strict';

/*
 * ============================================================================
 *  awesome-agents-md · v1.0.0
 *  "Stop AI from writing garbage code." — a zero-dependency AGENTS.md generator.
 * ============================================================================
 *
 *  No packages. No build step. No node_modules. Nothing but Node's own
 *  `fs`, `path` and `readline`. If you can run Node 18+, you can run this.
 *
 *  Usage:
 *     node index.js               interactive wizard (recommended)
 *     node index.js --yes         non-interactive, accept all defaults
 *     node index.js --force       overwrite an existing AGENTS.md without asking
 *     node index.js --out=PATH    write somewhere other than ./AGENTS.md
 *     node index.js --help | -h
 *     node index.js --version | -v
 *
 *  The generated file is a hard contract for AI coding agents: Cursor,
 *  DeepSeek Harness (DSH), GitHub Copilot, Claude Code, Codex, Windsurf...
 *  See README.md for the rant, and AGENTS.md for the rules.
 *
 *  Apache-2.0 — https://github.com/doujiaozh/awesome-agents-md
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const VERSION = '1.0.0';
const REPO = 'https://github.com/doujiaozh/awesome-agents-md';
const DEFAULT_OUT = 'AGENTS.md';
const OTHER = 'Other (specify)';

/* ─────────────────────────── output / ANSI ─────────────────────────────── */
const NO_COLOR = {
  reset: '', bold: '', dim: '', red: '', green: '', yellow: '',
  blue: '', magenta: '', cyan: '', gray: ''
};
const c = process.stdout.isTTY
  ? {
      reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
      red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
      blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m'
    }
  : NO_COLOR;

function banner() {
  const w = 64;
  const line = (t) => '║' + t.padEnd(w - 2) + '║';
  const body = [
    line(' awesome-agents-md'),
    line(' Stop AI from writing garbage code.'),
    line(' zero-dependency AGENTS.md generator  v' + VERSION)
  ].join('\n');
  return (
    c.cyan + c.bold + '╔' + '═'.repeat(w - 2) + '╗\n' + body +
    '\n╚' + '═'.repeat(w - 2) + '╝' + c.reset +
    '\n' + c.gray + '  because "update" is not a commit message.' + c.reset + '\n'
  );
}

/* ──────────────────────────── CLI plumbing ──────────────────────────────── */
function parseArgs(argv) {
  const out = { yes: false, force: false, help: false, version: false, out: null, unknown: [] };
  for (const a of argv) {
    if (a === '-h' || a === '--help') out.help = true;
    else if (a === '-v' || a === '--version') out.version = true;
    else if (a === '-y' || a === '--yes') out.yes = true;
    else if (a === '-f' || a === '--force') out.force = true;
    else if (a.startsWith('--out=')) out.out = a.slice('--out='.length);
    else out.unknown.push(a);
  }
  return out;
}

function printHelp() {
  console.log(banner());
  console.log(
    c.bold + 'Usage' + c.reset + '\n' +
    '  node index.js                 ' + c.gray + 'interactive wizard (recommended)' + c.reset + '\n' +
    '  node index.js --yes           ' + c.gray + 'non-interactive; accept all defaults' + c.reset + '\n' +
    '  node index.js --force         ' + c.gray + 'overwrite an existing AGENTS.md without asking' + c.reset + '\n' +
    '  node index.js --out=PATH      ' + c.gray + 'write to PATH instead of ./AGENTS.md' + c.reset + '\n' +
    '  node index.js -v, --version   ' + c.gray + 'print version' + c.reset + '\n' +
    '  node index.js -h, --help      ' + c.gray + 'this help' + c.reset + '\n' +
    '\n' + c.bold + 'Examples' + c.reset + '\n' +
    '  node index.js\n' +
    '  node index.js --yes --force --out=packages/api/AGENTS.md\n' +
    '\n' + c.gray +
    'Exit codes: 0 = contract written · 1 = error · 2 = refused (needs confirmation)' +
    c.reset + '\n'
  );
}

/* ───────────────────────── readline question engine ─────────────────────── */
/*
 * Question engine.
 *
 * Interactive TTY: each question waits for a line typed by the human.
 * Piped stdin: we buffer EVERY line that arrives — a burst of piped answers
 * can land before the next question is even asked, and naive chained
 * `rl.question()` silently drops those lines. One question drains one line,
 * FIFO. When stdin ends while questions are still open, the remaining
 * questions take their defaults instead of hanging forever.
 */
let rl = null;
let finished = false;
let stdinEnded = false;
const pendingLines = [];
const waitingResolvers = [];

function getRl() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdout.isTTY)
    });
    const abort = () => {
      process.stdout.write('\n' + c.red + '✗ aborted — nothing was written.' + c.reset + '\n');
      process.exit(130);
    };
    rl.on('SIGINT', abort);
    rl.on('line', (line) => {
      const resolve = waitingResolvers.shift();
      if (resolve) resolve(line);
      else pendingLines.push(line);
    });
    rl.on('close', () => {
      if (finished) return;
      stdinEnded = true;
      if (waitingResolvers.length > 0) {
        process.stdout.write(c.gray + '\n  · stdin ended early — remaining questions take their defaults.\n' + c.reset);
        while (waitingResolvers.length) waitingResolvers.shift()('');
      }
    });
  }
  return rl;
}

function ask(prompt) {
  return new Promise((resolve) => {
    getRl();
    process.stdout.write(prompt);
    const buffered = pendingLines.shift();
    if (buffered !== undefined) return resolve(buffered);
    if (stdinEnded) return resolve('');
    waitingResolvers.push(resolve);
  });
}

async function askText(label, def, validate) {
  const prompt = c.cyan + '?' + c.reset + ' ' + label + ' ' + c.gray + '[' + def + ']:' + c.reset + ' ';
  for (;;) {
    const raw = (await ask(prompt)).trim();
    const v = raw === '' ? def : raw;
    if (!validate || validate(v)) return v;
    console.log(c.red + '  ✗ invalid value, try again.' + c.reset);
  }
}

async function askSelect(label, options, defaultIndex) {
  const list = options.map((o, i) => {
    const marker = i === defaultIndex ? c.bold + '▸ ' + o + c.reset : '  ' + o;
    return '  ' + c.gray + (i + 1) + ')' + c.reset + ' ' + marker;
  }).join('\n');
  const prompt = c.cyan + '?' + c.reset + ' ' + label + '\n' + list +
    '\n  ' + c.gray + 'Choose [' + (defaultIndex + 1) + ']:' + c.reset + ' ';
  for (;;) {
    const raw = (await ask(prompt)).trim();
    if (raw === '') return options[defaultIndex];
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1];
    const hit = options.find((o) => o.toLowerCase() === raw.toLowerCase());
    if (hit) return hit;
    console.log(c.red + '  ✗ "' + raw + '" is not a valid choice.' + c.reset);
  }
}

async function askConfirm(label, defYes) {
  const prompt = c.cyan + '?' + c.reset + ' ' + label + ' ' + c.gray +
    '[' + (defYes ? 'Y/n' : 'y/N') + ']:' + c.reset + ' ';
  const raw = (await ask(prompt)).trim().toLowerCase();
  if (raw === '') return defYes;
  return raw === 'y' || raw === 'yes';
}

/* ──────────────────────────── sanitization ──────────────────────────────── */
function sanitizeName(s) {
  const cleaned = String(s).replace(/[`|<>\r\n\\[\]]/g, '').trim();
  return (cleaned.length > 0 && cleaned.length <= 80) ? cleaned : 'my-project';
}

/* ───────────────────── knowledge base: per-language rules ───────────────── */
const LANGUAGE_ORDER = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust', 'Other'];

const KNOWLEDGE = {
  TypeScript: {
    stack: {
      runtime: 'Node.js 20+ (or whichever runtime is pinned in the repo)',
      package: 'npm / pnpm — follow the lockfile already present',
      lint: 'ESLint + Prettier (follow the repo configs, never invent style)'
    },
    frameworks: ['None', 'React', 'Next.js', 'Vue 3', 'Express / Fastify', 'NestJS', OTHER],
    tests: ['vitest', 'jest', 'node --test', OTHER],
    naming: [
      ['Files', '`kebab-case.ts`; React components as `PascalCase.tsx`'],
      ['Functions / methods / variables', '`camelCase`'],
      ['Constants', '`UPPER_SNAKE_CASE`'],
      ['Types / interfaces / classes / enums', '`PascalCase`'],
      ['Booleans', 'question form: `isLoading`, `hasPermission`'],
      ['React components & hooks', 'components `PascalCase`; hooks `useXxx`']
    ],
    style: [
      'Keep `strict: true` — compiler strictness is a free reviewer; never weaken it to make an error disappear',
      'Explicit return types on exported functions',
      'No `any` without an inline `eslint-disable-next-line` plus a one-line justification',
      'No non-null assertion `!` to silence genuinely missing values — fix the type or add a guard',
      'Prefer `type` aliases for unions; `interface` for object shapes others may extend'
    ],
    errors: [
      'Throw typed `Error` subclasses — never strings, never bare objects without a stack',
      'Wrap and re-throw with `cause:` and the operation you were performing',
      'Return `null`/`undefined` only when absence is documented and expected',
      'Promise rejections carry errors, never strings'
    ],
    forbidden: [
      '`eval`, `new Function`, `setTimeout("string")`, `Function.prototype.constructor` tricks',
      '`dangerouslySetInnerHTML` / `innerHTML` with interpolation — framework DOM APIs instead',
      '`child_process.exec` / `execSync` with string interpolation — `spawn` / `execFile` with argv arrays',
      'unbounded regexes on unbounded input'
    ]
  },

  JavaScript: {
    stack: {
      runtime: 'Node.js 20+ (or whichever runtime is pinned in the repo)',
      package: 'npm / pnpm — follow the lockfile already present',
      lint: 'ESLint + Prettier (follow the repo configs, never invent style)'
    },
    frameworks: ['None', 'React', 'Next.js', 'Vue 3', 'Express / Fastify', OTHER],
    tests: ['vitest', 'jest', 'node --test', OTHER],
    naming: [
      ['Files', '`kebab-case.js`; React components as `PascalCase.jsx`'],
      ['Functions / methods / variables', '`camelCase`'],
      ['Constants', '`UPPER_SNAKE_CASE`'],
      ['Classes', '`PascalCase`'],
      ['Booleans', 'question form: `isLoading`, `hasPermission`']
    ],
    style: [
      'ES modules first — follow the `type` field in package.json',
      'No `var`, no implicit globals; `const` by default, `let` only when rebinding',
      'JSDoc on every exported symbol — the dynamic language needs the documentation',
      'No `==` outside `== null` checks; no implicit coercion games'
    ],
    errors: [
      'Throw `Error` subclasses — never strings, never bare objects without a stack',
      'Wrap and re-throw with `cause:` and the operation you were performing',
      'Return `null`/`undefined` only when absence is documented and expected',
      'Promise rejections carry errors, never strings'
    ],
    forbidden: [
      '`eval`, `new Function`, `setTimeout("string")`',
      '`innerHTML` / `document.write` with interpolation',
      '`child_process.exec` / `execSync` with string interpolation — `spawn` / `execFile` with argv arrays',
      'unbounded regexes on unbounded input'
    ]
  },

  Python: {
    stack: {
      runtime: 'Python 3.10+ (or the version pinned in pyproject.toml / .python-version)',
      package: 'pip / uv / poetry — follow the lockfile already present',
      lint: 'Ruff / Black (follow the repo configs, never invent style)'
    },
    frameworks: ['None', 'FastAPI', 'Django', 'Flask', OTHER],
    tests: ['pytest', 'unittest', OTHER],
    naming: [
      ['Files', '`snake_case.py`'],
      ['Functions / methods / variables', '`snake_case`'],
      ['Constants', '`UPPER_SNAKE_CASE`'],
      ['Classes', '`PascalCase`'],
      ['Private members', 'leading underscore `_internal`']
    ],
    style: [
      'Type hints on every public function; `from __future__ import annotations` where helpful',
      'Dataclasses / Pydantic models for DTOs — no bare dicts crossing module boundaries',
      '`pathlib` for every path — never raw `os.path` string surgery',
      'Imports sorted by the repo tool (isort/Ruff); no wildcard imports'
    ],
    errors: [
      'Raise specific exceptions (`ValueError`, custom domain exceptions) — never bare `Exception`',
      '`raise ... from err` to preserve the cause chain',
      'No bare `except:` and no `except Exception: pass` — a swallowed error is an undiagnosable bug',
      'Context managers (`with`) for every resource: files, locks, sessions'
    ],
    forbidden: [
      '`eval` / `exec`',
      '`os.system` / `subprocess(..., shell=True)` — argv lists only',
      '`pickle.loads` on untrusted input',
      '`yaml.load` (unsafe loader) — use `yaml.safe_load`',
      '`random` for anything security-relevant — use `secrets`'
    ]
  },

  Go: {
    stack: {
      runtime: 'Go toolchain pinned in go.mod / rust-toolchain equivalents',
      package: '`go mod` (vendored or proxied per repo policy)',
      lint: 'gofmt / goimports + golangci-lint (follow repo config)'
    },
    frameworks: ['None', 'gin', 'echo', OTHER],
    tests: ['go test ./...', OTHER],
    naming: [
      ['Files', '`snake_case.go`; one package per directory'],
      ['Exported identifiers', '`PascalCase` — the first letter IS the access control'],
      ['Unexported identifiers', '`camelCase`'],
      ['Interfaces', 'behavior names ending in `-er` (`Reader`, `Notifier`)'],
      ['Constants', '`MixedCaps` or `UPPER_SNAKE_CASE`'],
      ['Receivers', 'short and consistent; never `this` / `self`']
    ],
    style: [
      '`gofmt` / `goimports` are non-negotiable — never hand-format around them',
      'Prefer composition over inheritance; small interfaces defined in the consuming package',
      'Carry cancellation through `context.Context` at every API boundary',
      'Table-driven tests are the house style for anything with more than two cases'
    ],
    errors: [
      'Every error is checked explicitly — no `_ = err`, no discarded returns',
      'Wrap with `fmt.Errorf("doing X: %w", err)`; discriminate with `errors.Is` / `errors.As`',
      'No `panic` in library code — panics belong in `main` for truly unrecoverable states',
      'Sentinel errors are typed and exported at package boundaries'
    ],
    forbidden: [
      '`unsafe` in business code',
      '`panic` in library code',
      'string-concatenated SQL — always `database/sql` placeholders',
      'raw `os.Getenv` for secrets without a documented manager'
    ]
  },

  Java: {
    stack: {
      runtime: 'JDK 17+ (or the version pinned by the build tool)',
      package: 'Maven / Gradle — follow the lockfile already present',
      lint: 'Checkstyle / Spotless (follow repo config)'
    },
    frameworks: ['None', 'Spring Boot', OTHER],
    tests: ['JUnit 5 (mvn test)', 'JUnit 5 (gradle test)', OTHER],
    naming: [
      ['Files', '`PascalCase.java` — filename matches the single public class'],
      ['Classes / interfaces / enums / records', '`PascalCase`'],
      ['Methods / variables', '`camelCase`'],
      ['Constants', '`UPPER_SNAKE_CASE` (`static final`)'],
      ['Packages', 'all lowercase, no underscores']
    ],
    style: [
      'Prefer records for DTOs; `var` only where the type is obvious from the right side',
      'Constructor injection only — no field injection',
      'Package by feature, not by layer-kind, unless the repo already does otherwise',
      '`Optional<T>` as return type only, never as a parameter; never pass null explicitly'
    ],
    errors: [
      'Throw specific exceptions with a useful message; exceptions only for exceptional flow',
      'No `catch (Exception e) {}` — if you catch, you handle or rethrow with context',
      'try-with-resources for every `AutoCloseable`',
      'Fail fast on invalid state (`Objects.requireNonNull`, validation guards)'
    ],
    forbidden: [
      '`Runtime.exec` with string interpolation',
      'raw SQL concatenation — JPA criteria / parameterized queries',
      'deserialization of untrusted payloads without an allowlist',
      '`new Date()` / `Calendar` in new code — `java.time` instead'
    ]
  },

  Rust: {
    stack: {
      runtime: 'Rust toolchain pinned in rust-toolchain.toml',
      package: 'cargo (workspace layout per repo)',
      lint: 'rustfmt + clippy; CI runs `-D warnings`'
    },
    frameworks: ['None', 'axum', 'actix-web', OTHER],
    tests: ['cargo test', OTHER],
    naming: [
      ['Files / modules', '`snake_case.rs`'],
      ['Functions / variables', '`snake_case`'],
      ['Types / traits / enums / structs', '`PascalCase`'],
      ['Constants / statics', '`UPPER_SNAKE_CASE`'],
      ['Crate names', '`snake_case`']
    ],
    style: [
      'Clippy with `-D warnings` on CI — its lints are code review in disguise',
      'Ownership over cloning: borrow when you can, clone when the borrow checker is genuinely wrong',
      'No `unsafe` without a SAFETY comment and a human reviewer',
      'Module hierarchy follows the feature, not the file kind'
    ],
    errors: [
      'Every fallible call returns `Result`; error types implement `std::error::Error`',
      '`thiserror` for library error types; `anyhow` for application glue',
      'No `unwrap()` / `expect()` across trust boundaries or on external input',
      'Handle an error exactly once, at the layer that can act on it'
    ],
    forbidden: [
      '`unsafe` without a written SAFETY justification',
      '`unwrap()` on untrusted input',
      'string-concatenated SQL — the repo query builder / parameterization',
      'busy-wait loops without a documented reason'
    ]
  },

  Other: {
    stack: {
      runtime: '<fill in — the runtime this repo pins>',
      package: '<fill in — the manager this repo locks>',
      lint: '<fill in — follow the repo linter config, never invent style>'
    },
    frameworks: ['None', OTHER],
    tests: [OTHER],
    naming: [
      ['Files', 'follow the dominant convention already in the repo — never invent a new one'],
      ['Identifiers', 'one convention per layer; consistency with neighbors beats your taste'],
      ['Constants', '`UPPER_SNAKE_CASE` or the language idiom']
    ],
    style: [
      'Follow the repo\'s configured formatter and linter, never your defaults',
      'When in doubt, imitate the closest well-regarded file in the repo'
    ],
    errors: [
      'Never swallow errors; fail fast and preserve context while propagating',
      'Handle each error exactly once, at the layer that can act on it'
    ],
    forbidden: [
      '`eval` / `exec` / `shell=True` equivalents in any language',
      'string-concatenated SQL in any language',
      'deserialization of untrusted input without an allowlist'
    ]
  }
};

/* ─────────────────────── knowledge base: frameworks ─────────────────────── */
const FRAMEWORK_RULES = {
  None: { stack: [], dirs: '', rules: [] },

  React: {
    stack: ['React 18+ — function components and hooks only'],
    dirs: '`components/` presentational components · `hooks/` custom hooks · `lib/` pure helpers · colocate feature files within feature folders',
    rules: [
      'Function components only — no class components in new code',
      'List keys must be stable IDs — never array indices',
      'No side effects during render; effects are the last resort, not the first',
      'Props are typed; no object literals as props in hot paths',
      'no `dangerouslySetInnerHTML` (§6) — sanitize with DOMPurify only where genuinely unavoidable and justified'
    ]
  },

  'Next.js': {
    stack: ['Next.js App Router — React Server Components by default'],
    dirs: '`app/` routes · `components/` shared UI · `lib/` logic · never duplicate logic between client and server files',
    rules: [
      'Server Components by default; `"use client"` only where interactivity is required — as low in the tree as possible',
      'Route handlers for API endpoints; the metadata API for SEO',
      'Fetch on the server when possible; add a data-fetching library only where the repo already uses one',
      'Verify APIs against the pinned Next version before using them — `next/legacy` has no place in new code'
    ]
  },

  'Vue 3': {
    stack: ['Vue 3 — Composition API'],
    dirs: '`components/` UI · `composables/` reusable state · `stores/` state management · `lib/` pure helpers',
    rules: [
      'Single File Components with `<script setup>`',
      'Props typed with `defineProps` + TypeScript; `withDefaults` where needed',
      'Composables return reactive state, never raw mutable objects',
      'No `v-html` (§6) unless sanitized and justified'
    ]
  },

  'Express / Fastify': {
    stack: ['Node HTTP framework — thin transport layer'],
    dirs: '`routes/` (HTTP plumbing only) → `services/` (business logic) → `repositories/` (data access)',
    rules: [
      'Routes validate input at the boundary (zod / the validator already in the repo) and stay thin',
      'No business logic in route handlers; no direct data access from routes',
      'One error-handling middleware at the app boundary; errors carry a correlation id',
      'No async work in routes without explicit error propagation'
    ]
  },

  NestJS: {
    stack: ['NestJS — dependency injection, modules by feature'],
    dirs: 'feature modules: `controller` → `service` → `repository` (or the ORM gateway)',
    rules: [
      'Controllers stay thin; services own the logic',
      'Validate with the `ValidationPipe` and DTOs — never trust a request body',
      'No cross-module direct service access — go through a module boundary',
      'Exceptions via NestJS exception filters / `HttpException`; no raw `throw new Error()` in controllers'
    ]
  },

  FastAPI: {
    stack: ['FastAPI — async endpoints, Pydantic validation'],
    dirs: '`routers/` endpoints → `services/` logic → `repositories/` data · `schemas/` for Pydantic models',
    rules: [
      'Pydantic models validate every request at the boundary; never touch raw request bodies',
      'No blocking IO inside `async def` endpoints — offload to a threadpool or make them `def`',
      'Dependency injection for auth, DB sessions, and rate limits',
      'Raise `HTTPException` from endpoints; domain exceptions from services'
    ]
  },

  Django: {
    stack: ['Django ORM (+ DRF if present in the repo)'],
    dirs: 'one app per feature: `models.py` · `views.py` · `serializers.py` · `urls.py` · `tests/`',
    rules: [
      'Fat models, thin views; logic belongs on the model or a service module — never in the view',
      'Schema changes go through migrations — never hand-edit a database',
      'DRF serializers validate at the boundary; never trust request data',
      'Queries use `select_related` / `prefetch_related` to avoid N+1'
    ]
  },

  Flask: {
    stack: ['Flask — blueprints per feature'],
    dirs: 'one blueprint per feature · `services/` for logic · `repositories/` for data · never SQL in route files',
    rules: [
      'Routes are thin; validation happens at the boundary',
      'No SQL string concatenation — SQLAlchemy parameterization, always',
      'App-level error handlers; no bare `except: pass`'
    ]
  },

  'Spring Boot': {
    stack: ['Spring Boot — constructor injection, REST boundaries'],
    dirs: 'package by feature: `controller` → `service` → `repository`; record DTOs at boundaries',
    rules: [
      'Constructor injection only — no `@Autowired` on fields',
      'DTOs at every HTTP boundary — entities never leave the service layer',
      'Validate request bodies with Jakarta validation annotations',
      'Transactions live on the service layer, never in controllers'
    ]
  },

  gin: {
    stack: ['gin — minimal HTTP routing'],
    dirs: '`handler/` (HTTP only) → `service/` (logic) → `repo/` (data)',
    rules: [
      'Handlers bind + validate at the boundary; logic lives in services',
      'No business logic in route definitions',
      'Centralized error middleware; errors carry context'
    ]
  },

  echo: {
    stack: ['echo — minimal HTTP routing'],
    dirs: '`handler/` (HTTP only) → `service/` (logic) → `repo/` (data)',
    rules: [
      'Handlers bind + validate at the boundary; logic lives in services',
      'No business logic in route definitions',
      'Centralized error middleware; errors carry context'
    ]
  },

  axum: {
    stack: ['axum — async, tower middleware'],
    dirs: '`routes/` handlers → `services/` logic → `repositories/` data; extractors at the edge',
    rules: [
      'Extractors validate at the boundary; handlers stay thin',
      'Errors as `Result<Response, AppError>` with `IntoResponse`',
      'No `.unwrap()` on request data (§6)'
    ]
  },

  'actix-web': {
    stack: ['actix-web — actor-based HTTP'],
    dirs: '`routes/` handlers → `services/` logic → `repositories/` data',
    rules: [
      'Extractors validate at the boundary; handlers stay thin',
      'Errors implement `ResponseError`; no `unwrap()` on request data',
      'No blocking IO in async handlers — `web::block` for CPU-heavy work'
    ]
  }
};

const TEST_COMMANDS = {
  'vitest': 'vitest run (CI) — never `vitest` watch in scripts',
  'jest': 'jest --ci',
  'node --test': 'node --test',
  'pytest': 'python -m pytest -q',
  'unittest': 'python -m unittest discover -s tests',
  'go test ./...': 'go test ./...',
  'cargo test': 'cargo test --all-targets',
  'JUnit 5 (mvn test)': 'mvn -B test',
  'JUnit 5 (gradle test)': './gradlew test'
};

/* ────────────────────── strictness & security presets ───────────────────── */
const STRICTNESS_ORDER = [
  'Strict — full TDD (failing test first, always)',
  'Balanced — read tests before editing (recommended)',
  "Light — just don't break the suite"
];
const STRICTNESS = {
  'Strict — full TDD (failing test first, always)': {
    lead: 'Every behavior change on this project is written test-first. No exceptions, no "the change is trivial".',
    before: [
      '**MUST** read every test covering the module you are about to change — before touching production code',
      '**MUST** run those tests and record the before-state ("3 passed, 1 skipped"). You cannot fix what you have never seen fail',
      '**MUST** write the failing test BEFORE the production change, for every behavior change — features included, not just bugfixes'
    ],
    after: [
      '**MUST** run the full suite and report the exact command and the pass/fail numbers',
      '**MUST** cover the lines you changed to at least 80%'
    ]
  },
  'Balanced — read tests before editing (recommended)': {
    lead: 'The suite is the only executable specification this project has.',
    before: [
      '**MUST** read the tests covering the module you are about to change — before touching production code',
      '**MUST** run those tests and record the before-state ("3 passed, 1 skipped"). You cannot fix what you have never seen fail',
      '**MUST** reproduce a bug as a failing test BEFORE writing the fix. No failing test → no production change'
    ],
    after: [
      '**MUST** run the full suite — not "the ones I touched" — and report the exact command and the numbers',
      '**SHOULD** cover the error branches your change introduces or modifies'
    ]
  },
  "Light — just don't break the suite": {
    lead: 'Light is not "no rules" — it is "the suite is the referee".',
    before: [
      '**MUST** run the tests covering the code you change, and know their before-state',
      '**MUST** still reproduce a reported bug with a failing test before fixing it'
    ],
    after: [
      '**MUST** run the full suite before reporting done, and report the exact command and the numbers'
    ]
  }
};
const TESTS_COMMON = [
  '**MUST NOT** delete, skip, `xtest`, `pytest.mark.skip`, `.only`, or loosen assertions to turn red into green. If you believe the test itself is wrong, say so out loud and get a human\'s nod before touching it',
  '**MUST NOT** replace assertions with tautologies (`expect(true).toBe(true)`, `assert True`). A test that cannot fail is a lie',
  '**MUST NOT** mock the code under test. You may mock the *world* — network, clock, filesystem — through documented seams',
  '**MUST NOT** write tests that depend on execution order or shared mutable state'
];
const SECURITY_ORDER = [
  'Paranoid — full red lines + default-deny (recommended)',
  'Standard — core red lines only'
];
const SECURITY = {
  'Paranoid — full red lines + default-deny (recommended)': {
    extra: [
      '**MUST** refuse to add any network call, telemetry, analytics, or outbound HTTP unless the task explicitly requires it — and then flag it in the final summary',
      '**MUST** audit any proposed dependency for known advisories before proposing it (npm audit / pip-audit / cargo audit)',
      '**MUST NOT** execute code fetched from the internet at build or install time without surfacing it to a human first',
      '**MUST** treat every shell-adjacent API as guilty until proven necessary'
    ]
  },
  'Standard — core red lines only': { extra: [] }
};

/* ───────────────────────────── markdown kit ─────────────────────────────── */
function table(headers, rows) {
  const lines = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |'
  ];
  for (const r of rows) lines.push('| ' + r.join(' | ') + ' |');
  return lines.join('\n');
}

const TREE = [
  '```',
  'repo root',
  '├── src/                     # ALL production code lives here',
  '│   ├── <feature>/           #   feature modules, self-contained',
  '│   ├── services/            #   business logic — framework-agnostic where possible',
  '│   ├── lib/ | utils/        #   pure helpers, zero side effects',
  '│   └── types/ | models/     #   shared types / domain models',
  '├── tests/ | __tests__/      # mirrors src/ structure 1:1',
  '├── scripts/                 # operational scripts (migrations, deploy)',
  '├── docs/                    # prose',
  '└── …config files live at root, period',
  '```'
];

const COMMIT_TYPES = [
  ['`feat`', 'a new user-facing capability'],
  ['`fix`', 'a bug fix'],
  ['`perf`', 'performance improvement with no behavior change'],
  ['`refactor`', 'restructuring — no new feature, no bug fixed'],
  ['`test`', 'adding or correcting tests'],
  ['`docs`', 'documentation only'],
  ['`style`', 'formatting / whitespace — no logic change'],
  ['`build`', 'build system, dependencies, toolchain'],
  ['`ci`', 'CI configuration'],
  ['`chore`', 'misc. maintenance that fits nothing above'],
  ['`revert`', 'reverting an earlier commit']
];

const ANTIPATTERNS = [
  ['**Hallucinated imports** — APIs that look right but do not exist', 'It compiles in your imagination, nowhere else'],
  ['"It works on my machine" — reporting success without running the suite', 'You are paid in trust; this spends it'],
  ['Unrequested big-bang refactors', 'Nobody asked, and the diff is now unreviewable'],
  ['Drive-by dependency upgrades', 'Fun for you, CVE review for the human'],
  ['Silently weakening assertions to make red green', 'You did not fix the bug — you fired the whistleblower'],
  ['`console.log` / `print` debugging left in committed code', 'Production will thank you with a 3 AM screenshot'],
  ['Empty catch — the error that died without a sound', 'The bug is now undiagnosable by design'],
  ['Inventing config/CLI flags from memory instead of reading the config', 'Machines remember; engineers verify'],
  ['Sycophancy — agreeing with a flawed plan because a human proposed it', 'An agent\'s most valuable sentence is "I think there is a problem with this plan."']
];

/* ───────────────────────────── renderering ──────────────────────────────── */
function renderHeader(cfg, date) {
  const stackLine = cfg.language +
    (cfg.framework !== 'None' ? ' · ' + cfg.framework : '') +
    ' · tests: ' + cfg.testRunner;
  return [
    '# AGENTS.md — The Binding AI Coding Contract for ' + cfg.project,
    '',
    '> **Version:** 1.0.0 · **Generated:** ' + date,
    '> **Stack:** ' + stackLine,
    '> **Applies to:** every AI coding agent that touches this repository — Cursor, DeepSeek Harness (DSH), GitHub Copilot, Claude Code, Codex, Windsurf, Aider, Cline, and whatever arrives next.',
    '>',
    '> *Generated by [awesome-agents-md](' + REPO + ') · Apache-2.0. Review it, edit it, commit it — an unreviewed contract protects nobody.*',
    '',
    '---',
    ''
  ].join('\n');
}

function renderPreamble() {
  return [
    '## 📜 Preamble — read this before your first keystroke',
    '',
    'You are an AI coding agent operating inside a repository that **belongs to humans**.',
    'Think of yourself as a junior engineer on day one: brilliant, fast, and dangerous —',
    'which is exactly why these house rules exist. Read them. Follow them. When in doubt,',
    '**ask instead of guess.**',
    '',
    '**Precedence (highest → lowest):**',
    '',
    '1. An explicit instruction from a human in the current conversation.',
    '2. **This file.**',
    '3. Your built-in style preferences and "helpfulness" instincts.',
    '4. Whatever the existing code happens to look like.',
    '',
    'If your defaults contradict a rule in this file → **this file wins.**',
    '',
    'Rule keywords **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) semantics — a **MUST** is not negotiable, not a style preference, and not something you trade off for speed.',
    '',
    'Two rules conflict → the stricter rule wins. Section 6 (security) outranks everything below it. Not sure a rule applies → assume it applies.',
    '',
    '---',
    ''
  ].join('\n');
}

function renderStack(cfg, K, fw) {
  const cmd = TEST_COMMANDS[cfg.testRunner];
  const rows = [
    ['Language', '**' + cfg.language + '**'],
    ['Runtime / toolchain', K.stack.runtime],
    ['Framework', cfg.framework === 'None' ? 'none — framework-agnostic' : '**' + cfg.framework + '**'],
    ['Test runner', '**' + cfg.testRunner + '**' + (cmd ? ' · canonical: `' + cmd + '`' : '')],
    ['Package manager', K.stack.package],
    ['Lint / format', K.stack.lint]
  ];
  const lines = [
    '## 1. 🧱 Project & technology stack',
    '',
    table(['Aspect', 'Value'], rows)
  ];
  if (fw.stack.length) {
    lines.push('', 'Framework specifics:');
    for (const s of fw.stack) lines.push('- ' + s);
  }
  lines.push(
    '',
    '- **MUST NOT** add a dependency, runtime, or tool without explicit human approval. To propose one, state: what it replaces, its license, its install size, and why the standard library is not enough.',
    '- **MUST NOT** migrate this codebase to a different framework, version, or style as a side quest.',
    '- **MUST** verify every API you use against the pinned manifests before using it — your memory of an API is a hypothesis, not a fact.',
    '- **MUST NOT** bump or downgrade dependency versions as a side effect of an unrelated change.',
    '- **SHOULD** prefer the standard library for anything solvable in under ~20 lines of boring code.',
    '',
    '---',
    ''
  );
  return lines.join('\n');
}

function renderDirs(fw) {
  const lines = [
    '## 2. 📁 Directory structure constraints',
    '',
    '**Top-level directories are a frozen API surface:**',
    ''
  ].concat(TREE);
  if (fw.dirs) lines.push('', '**This stack:** ' + fw.dirs);
  lines.push(
    '',
    '- **MUST NOT** create a new top-level directory without asking. A new folder is an architecture decision, not a filing convenience.',
    '- **MUST NOT** clone files into `*-new`, `*-v2`, `tmp/`, `scratch/`, `refactor/`, or `legacy/` siblings. You **edit** the file; you do not resurrect copies of it.',
    '- **MUST** place every new file in the layer matching its responsibility. Ties go to the shallower layer.',
    '- **MUST** follow the naming conventions of §3.1.',
    '- **SHOULD** keep modules under ~300 lines; a file crossing ~500 lines is a smell — mention it, do not silently split it.',
    '- **MUST NOT** move or rename files unless that is the task. A renamed file is a murdered diff.',
    '',
    '---',
    ''
  );
  return lines.join('\n');
}

function renderStyle(cfg, K, fw) {
  const lines = [
    '## 3. ✍️ Code style — naming, comments, error handling',
    '',
    '### 3.1 Naming on this stack',
    '',
    table(['Element', 'Convention'], K.naming),
    '',
    '- **MUST NOT** use abbreviations outside established domain terms (`usr`, `tmp`, `data2`, `str1` are banned).',
    '- **MUST** name collections plurally (`users`, not `userList` unless it is genuinely a typed list).',
    '- **MUST** name booleans as questions (`isLoading`, `hasPermission`).',
    '',
    '### 3.2 Comments & documentation',
    '',
    '- **MUST** write comments for **WHY**, never for **WHAT** — if the *what* is not obvious, the code is the problem.',
    '- **MUST NOT** leave commented-out code in a committed change. Git is your undo key, not your basement.',
    '- **MUST** document every exported symbol of a public module (JSDoc / docstring): intent, params, return, exceptions.',
    '- **MUST** format TODOs as `TODO(<name-or-context>): what — why not now`.',
    '',
    '### 3.3 Functions',
    '',
    '- **MUST** keep functions single-purpose. **SHOULD** stay ≤ ~40 lines and ≤ ~4 parameters — beyond that, group into a typed options object.',
    '- **MUST NOT** add boolean parameters that silently fork behavior ("flag argument" = two hidden functions in a trench coat).',
    '- **SHOULD** default to pure functions; push side effects to the edges of the system.'
  ];
  if (K.style.length) {
    lines.push('', '### 3.4 Stack-specific style', '');
    for (const s of K.style) lines.push('- ' + s);
  }
  lines.push('', '### 3.5 Error handling — the non-negotiable core', '');
  for (const e of K.errors) lines.push('- ' + e);
  lines.push(
    '- **MUST NOT** swallow errors silently — no empty catch, no `pass`, no `catch (e) { return null }` without a comment saying why.',
    '- **MUST NOT** use exceptions/panics for ordinary control flow.',
    '- **MUST** log an error exactly once, at the boundary that holds the context. Chained logging is log spam, not defense in depth.'
  );
  if (fw.rules.length) {
    lines.push('', '### 3.6 Framework rules (' + cfg.framework + ')', '');
    for (const r of fw.rules) lines.push('- ' + r);
  }
  lines.push(
    '',
    '### 3.7 Formatting & diffs',
    '',
    '- **MUST** follow the repo\'s configured formatter/linter — never invent style.',
    '- **MUST NOT** reformat code outside your change\'s scope. Drive-by reformatting turns a 3-line fix into a 400-line review.',
    '- **MUST NOT** churn whitespace, quotes, or semicolons in files you are not otherwise touching.',
    '',
    '---',
    ''
  );
  return lines.join('\n');
}

function renderTests(cfg) {
  const key = cfg.strictness;
  const S = STRICTNESS[key] || STRICTNESS[STRICTNESS_ORDER[1]];
  const label = key.split(' —')[0].split(' (')[0];
  const cmd = TEST_COMMANDS[cfg.testRunner];
  const lines = [
    '## 4. 🧪 Tests-first protocol — ' + label,
    '',
    '> ' + S.lead,
    '',
    '**Before touching production code:**',
    ''
  ];
  for (const b of S.before) lines.push('- ' + b);
  lines.push('', '**While working:**', '');
  for (const b of TESTS_COMMON) lines.push('- ' + b);
  lines.push('- **MUST** cover the error branches your change introduces or modifies.');
  lines.push('', '**When done:**', '');
  for (const a of S.after) lines.push('- ' + a);
  lines.push(
    '- **MUST NOT** report "tests pass" without having run them. **Fabricated verification is the worst thing an agent can do here** — it is a lie humans will act on.',
    '- Test runner for this repo: **' + cfg.testRunner + '**' + (cmd ? '; canonical command: `' + cmd + '`' : '; canonical command: `<fill in>`.'),
    '',
    '---',
    ''
  );
  return lines.join('\n');
}

function renderGit() {
  return [
    '## 5. 🗂️ Git discipline — Conventional Commits',
    '',
    '**MUST** format every commit:',
    '',
    '```',
    '<type>(<scope>): <subject in imperative mood, lowercase, no trailing period, ≤ 72 chars>',
    '',
    '<optional body — WHY the change was made; wrap at 72 chars>',
    '',
    '<optional footers — BREAKING CHANGE: <desc> · Fixes #123 · Refs #456>',
    '```',
    '',
    table(['type', 'use it for'], COMMIT_TYPES),
    '',
    'The eternal difference:',
    '',
    '- ✅ `fix(auth): reject expired refresh tokens before rotation`',
    '- ❌ `update` · `fix bug` · `asdf` · `final fixes` · `wip 2` · `🚀🚀`',
    '',
    '- **MUST NOT** commit while the suite is red. Red suite → fix it or back it out.',
    '- **MUST NOT** use `--no-verify` to skip pre-commit hooks.',
    '- **MUST NOT** push directly to `main`/`master` — work on `<type>/<short-slug>` and open a PR.',
    '- **MUST NOT** force-push, rebase, or rewrite shared branches.',
    '- **MUST** keep one logical change per commit: a `feat` and its tests travel together.',
    '',
    '---',
    ''
  ].join('\n');
}

function renderSecurity(cfg, K) {
  const sec = SECURITY[cfg.security] || SECURITY[SECURITY_ORDER[0]];
  const lines = [
    '## 6. 🔒 Security red lines — the absolute bans',
    '',
    'These are not preferences. Crossing one is an instant, unrecoverable trust failure.',
    '',
    '### 6.1 Secrets',
    '',
    '- **MUST NEVER** hardcode an API key, token, password, private URL, connection string, or `.env` content into source, tests, scripts, comments, commit messages, or chat output.',
    '- **MUST NEVER** stage or commit `.env`, `*.pem`, `*.key`, or any credentials file — scan the diff for accidental adds before committing.',
    '- **MUST** read runtime configuration only from documented environment variables or a secrets manager.',
    '- If you discover or accidentally print a secret: **MUST** stop, say it out loud immediately, and never echo it again.',
    '',
    '### 6.2 Forbidden APIs on this stack (default-deny; exceptions require written human approval)',
    ''
  ];
  for (const f of K.forbidden) lines.push('- ' + f);
  lines.push(
    '- string-concatenated SQL in any layer → parameterized / prepared statements, always.',
    '- unbounded regexes on unbounded input → bounded parsing with input-length limits.',
    '',
    '### 6.3 Dependencies & supply chain',
    '',
    '- **MUST NOT** add an unvetted dependency: it must be actively maintained, license-compatible, and non-redundant with what is already present.',
    '- **MUST NOT** run install-time scripts from untrusted packages without surfacing it to a human first.'
  );
  if (sec.extra.length) {
    lines.push('');
    for (const e of sec.extra) lines.push('- ' + e);
  }
  lines.push(
    '',
    '### 6.4 System & data hygiene',
    '',
    '- **MUST NEVER** run recursive deletes outside the repository root, or touch files outside the working tree without explicit instruction.',
    '- **MUST NEVER** upload, POST, or transmit this repository or user data to any external service, unless that is explicitly the task.',
    '- **MUST NEVER** alter credentials, SSH/GPG keys, git identity, or CI secrets.',
    '- **MUST** treat PII as radioactive: never log it, never paste it into examples, fixtures, or test data.',
    '',
    '### 6.5 The default-deny rule',
    '',
    'Anything this contract does not explicitly permit — and any behavior you are not sure about — is **forbidden until a human approves it.** When the red line and your "helpfulness instinct" disagree, the red line wins. Every time.',
    '',
    '---',
    ''
  );
  return lines.join('\n');
}

function renderWorkflow() {
  return [
    '## 7. 🤖 Workflow protocol — how every task is executed',
    '',
    '0. **Re-read this file.** It changes between tasks; your cached memory of it is stale.',
    '1. **Reproduce & locate.** `grep` before you guess, read before you write. **MUST** search for an existing utility before creating a new one — a duplicate helper is a design bug, and it would be *your* design bug.',
    '2. **Plan up front.** State the files you will touch, the expected diff size, and the tests that cover them. Beyond ~10 bullets or >5 files, surface the plan and get a human\'s nod for big refactors.',
    '3. **Failing test first** for any bug fix (§4).',
    '4. **Edit surgically.** Smallest diff that solves the task. No style churn, no unrequested renames, no "while I\'m here let me also…".',
    '5. **Verify for real.** Full suite, linter, type checker — paste the actual command and the actual numbers into your report.',
    '6. **Report.** What changed, what you verified, what you deliberately did **not** do, and what a human should double-check next.',
    '',
    '---',
    ''
  ].join('\n');
}

function renderAntiPatterns() {
  return [
    '## 8. 🪦 Anti-patterns — the hall of shame',
    '',
    table(['Anti-pattern', 'Why it is fatal'], ANTIPATTERNS),
    '',
    '---',
    ''
  ].join('\n');
}

function renderEscalation() {
  return [
    '## 9. 🧭 Ambiguity, errors, and escalation',
    '',
    '- **MUST** ask rather than assume when: intent is unclear; two rules conflict; a change would cross a red line; an instruction contradicts the tests.',
    '- **MUST** report the exact failing command and verbatim error text — never paraphrased into a vague "didn\'t work".',
    '- **MUST NOT** guess at environment, credentials, or network state.',
    '- **MUST NEVER** fabricate test output, coverage numbers, or "it runs" claims.',
    '- **MUST** stop and surface when a task needs more than ~30 minutes of unobserved destructive work — check in, do not disappear down a rabbit hole.',
    '',
    '---',
    ''
  ].join('\n');
}

function renderChecklist() {
  return [
    '## 10. ✅ Completion checklist — print this, filled, before saying "done"',
    '',
    '```',
    '## Agent self-check',
    '- [ ] Tests: <exact command> → <N passed, M failed, K skipped>',
    '- [ ] Lint / typecheck: <command> → clean',
    '- [ ] Files touched: <list>  (diff: +<N> / -<M>)',
    '- [ ] No secrets, credentials, or .env content anywhere in the diff',
    '- [ ] No new dependencies added (or: <dep> — approved by <who>)',
    '- [ ] No commented-out code or debug logging left behind',
    '- [ ] Commit message(s) follow Conventional Commits (§5)',
    '- [ ] Docs updated wherever public behavior changed',
    '- [ ] Nothing outside the task scope was reformatted, renamed, or refactored',
    '```',
    '',
    'If you cannot tick a box, **MUST** say so explicitly instead of ticking it. A box you did not verify is a lie with a check mark on it.',
    '',
    '---',
    ''
  ].join('\n');
}

function renderFooter(date) {
  return [
    '> **For humans:** this contract is versioned with the repo — review it like code, change it via PR (`docs(rules): …`). When the agent disobeys, the bug is usually in this file, not in the model.',
    '>',
    '> Generated by [awesome-agents-md](' + REPO + ') v' + VERSION + ' on ' + date + ' · Apache-2.0',
    ''
  ].join('\n');
}

function render(cfg) {
  const langKey = (cfg.language in KNOWLEDGE) ? cfg.language : 'Other';
  const K = KNOWLEDGE[langKey];
  const fw = FRAMEWORK_RULES[cfg.framework] || FRAMEWORK_RULES.None;
  const date = new Date().toISOString().slice(0, 10);
  return [
    renderHeader(cfg, date),
    renderPreamble(),
    renderStack(cfg, K, fw),
    renderDirs(fw),
    renderStyle(cfg, K, fw),
    renderTests(cfg),
    renderGit(),
    renderSecurity(cfg, K),
    renderWorkflow(),
    renderAntiPatterns(),
    renderEscalation(),
    renderChecklist(),
    renderFooter(date)
  ].join('\n');
}

/* ─────────────────────────────── wizard ─────────────────────────────────── */
function defaultConfig() {
  return {
    project: sanitizeName(path.basename(process.cwd())),
    language: 'TypeScript',
    framework: 'None',
    testRunner: 'vitest',
    strictness: STRICTNESS_ORDER[1],
    security: SECURITY_ORDER[0]
  };
}

async function collect() {
  const d = defaultConfig();
  const cfg = {};

  cfg.project = await askText('Project name?', d.project, (v) => v.length > 0 && v.length <= 80);

  cfg.language = await askSelect('Primary language?', LANGUAGE_ORDER, 0);
  if (cfg.language === 'Other') {
    cfg.language = await askText('Language name?', 'Elixir', (v) => v.length > 0 && v.length <= 40);
  }
  const langKey = (cfg.language in KNOWLEDGE) ? cfg.language : 'Other';
  const K = KNOWLEDGE[langKey];

  cfg.framework = await askSelect('Framework?', K.frameworks, 0);
  if (cfg.framework === OTHER) {
    cfg.framework = await askText('Framework name?', 'Qwik', (v) => v.length > 0 && v.length <= 40);
  }

  cfg.testRunner = await askSelect('Test runner?', K.tests, 0);
  if (cfg.testRunner === OTHER) {
    cfg.testRunner = await askText('Test runner name?', 'make test', (v) => v.length > 0 && v.length <= 40);
  }

  cfg.strictness = await askSelect('Tests-first strictness?', STRICTNESS_ORDER, 1);
  cfg.security = await askSelect('Security level?', SECURITY_ORDER, 0);

  return cfg;
}

function printSummary(cfg, outPath) {
  const rows = [
    ['project', cfg.project],
    ['language', cfg.language],
    ['framework', cfg.framework],
    ['test runner', cfg.testRunner],
    ['strictness', cfg.strictness],
    ['security', cfg.security]
  ];
  console.log(c.bold + '  your contract:' + c.reset);
  for (const [k, v] of rows) console.log(c.gray + '    ' + k.padEnd(11) + ' ' + v + c.reset);
  console.log(c.gray + '    ' + 'output'.padEnd(11) + ' ' + path.relative(process.cwd(), outPath) + c.reset + '\n');
}

function reportSuccess(outPath, content) {
  const lines = content.split('\n').length;
  const kb = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
  console.log(c.green + c.bold + '  ✓ wrote ' + path.relative(process.cwd(), outPath) + c.reset +
    c.gray + '   (' + lines + ' lines · ' + kb + ' KB)' + c.reset + '\n');
  console.log(c.bold + '  next:' + c.reset);
  console.log(c.gray + '    git add ' + path.basename(outPath) +
    ' && git commit -m "docs(rules): bind the AGENTS.md contract"' + c.reset);
  console.log(c.gray + '    mount it into Cursor / DeepSeek Harness / Claude Code — see README.md § "挂载"' + c.reset);
  console.log('');
}

/* ──────────────────────────────── main ──────────────────────────────────── */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) { printHelp(); return 0; }
  if (args.version) { console.log('awesome-agents-md v' + VERSION); return 0; }
  if (args.unknown.length > 0) {
    console.error(c.red + '✗ unknown argument(s): ' + args.unknown.join(', ') + ' — try --help.' + c.reset);
    return 2;
  }

  console.log(banner());

  let cfg;
  if (args.yes) {
    cfg = defaultConfig();
    console.log(c.gray + '  --yes: accepted all defaults' + c.reset + '\n');
  } else {
    cfg = await collect();
  }

  const outPath = path.resolve(process.cwd(), args.out || DEFAULT_OUT);

  printSummary(cfg, outPath);

  if (fs.existsSync(outPath) && !args.force) {
    if (args.yes) {
      console.error(c.red + '  ✗ ' + path.basename(outPath) + ' already exists here. Re-run without --yes to confirm the overwrite, or pass --force.' + c.reset);
      return 2;
    }
    const ok = await askConfirm(path.basename(outPath) + ' already exists — overwrite? (the old file is saved to ' + path.basename(outPath) + '.bak first)', true);
    if (!ok) {
      console.log(c.yellow + '  · aborted — your existing file was left untouched.' + c.reset);
      return 0;
    }
  }

  const content = render(cfg);
  if (fs.existsSync(outPath)) fs.copyFileSync(outPath, outPath + '.bak');
  fs.writeFileSync(outPath, content, 'utf8');
  reportSuccess(outPath, content);
  return 0;
}

main().then((code) => {
  finished = true;
  if (rl) rl.close();
  process.exitCode = code;
}).catch((err) => {
  finished = true;
  if (rl) rl.close();
  console.error(c.red + (err && err.stack ? err.stack : String(err)) + c.reset);
  process.exitCode = 1;
});
