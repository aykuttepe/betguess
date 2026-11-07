# Backend → Frontend handoff (template)
Feature: TBD
Owner: Claude backend; consumer: Codex frontend
API endpoint and method: TBD
Authentication/authorization: TBD
Request/response schemas and examples: TBD
Status/error codes: TBD
Pagination, loading, empty/error states: TBD
Versioning/deprecation: TBD
Mock/staging endpoint: TBD
Contract tests and acceptance criteria: TBD

---

## Handoff 2026-11-08 — Auth rate limits, kolon generation, session changes
Branch: `p0/delivery-hardening`. Owner: Claude backend; consumer: Codex frontend. Status: server done, not deployed; client verification pending.
Auth: httpOnly cookies (`access_token`, `refresh_token`) with `credentials: 'include'`; unchanged.

### 1. Rate-limit responses (new 429)
All return `429 { "error": "<Turkish message>" }` plus `Retry-After: <seconds>`. Counters are fixed windows and survive server restarts.

| Endpoint | Limit | Retry-After |
|---|---|---|
| `POST /api/auth/login` | 30/IP and 10/account per 15 min; a successful login clears the account counter | 900 |
| `POST /api/auth/register` | 10/IP and 3/email per 15 min | 900 |
| `POST /api/auth/forgot-password` | 30/IP and 3/account per 15 min | 900 |
| `POST /api/auth/reset-password` | 30/IP and 5/account per 15 min | 900 |
| `POST /api/auth/send-verification-otp`, `POST /api/auth/update-phone`, `PATCH /api/auth/profile` (only when `phoneNumber` changes) | 3 per user per 15 min, shared across these paths | 900 |
| `POST /api/kolons/generate` | 10 per user per minute (admins included) | 60 |

UI acceptance: show `error` text, do not lock the form permanently, do not auto-retry. Login 429 must not be shown as "wrong password".

### 2. Kolon generation
`POST /api/kolons/generate` (auth required)
Request: `{ "inputs": [{ "matchNumber": 1, "outcomes": ["1", "X"] }] }`. Rules: 1–15 matches, unique `matchNumber` 1–15, 1–3 unique outcomes from `"1" | "X" | "2"`.
Response 200: `{ "kolonlar": [{ "id": 1, "predictions": ["1", "2"] }] }`
Errors: 400 invalid selection or over the per-request cap (`error` says the cap); 401 no session; 403/429 daily quota (`requiredTier`, `feature`, `limit`, `used`) when subscriptions are active; 429 throttle; 500.
Per-request cap: free 10,000, pro 50,000, premium 500,000; admins and trial mode 500,000. Read it from `GET /api/auth/usage-status` → `limits.kolon.limit`; `-1` means the 500,000 technical ceiling.

### 3. Session and usage changes
- `POST /api/auth/change-password` and `POST /api/auth/reset-password` clear auth cookies and revoke all existing sessions on success. UI: route to login with a success message.
- After deploy every existing session is invalid once; users must sign in again (expect 401 → existing redirect).
- `GET /api/auth/usage-status`: all limits are `-1` for admins or when the subscription system is off; tier is the effective tier (expired paid plans count as free).
- Requests with an `Origin` header not in `CORS_ORIGINS` receive `403 { "error": "Origin not allowed." }`.

Contract tests: `server/src/auth/security.test.ts`, `server/src/services/kolon-generation.test.ts` (`cd server && npm test`).
