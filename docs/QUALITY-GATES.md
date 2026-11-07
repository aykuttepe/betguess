# Professional delivery quality gates
Gate A — Scope: acceptance criteria and out-of-scope documented; change owner and API handoff identified.
Gate B — Code: lint/typecheck/build for the actual project; mandatory checks must FAIL if absent rather than silently succeed. Peer review or explicit owner sign-off for critical changes.
Gate C — Test: unit and integration; E2E for critical user journeys; UI visual/mobile/keyboard verification when frontend is present. Record environment and evidence.
Gate D — Security: secret scan and static/dependency checks configured; authn/authz, data separation, input validation and OWASP risks reviewed for relevant features. Findings disposition documented.
Gate E — Release: reproducible build, staging smoke tests, schema compatibility, approved migration/backup/rollback, monitored deploy.
Gate F — Handover: README, operations/runbook, environment variable template with no secrets, architecture/API contract, change log, known limitations, acceptance sign-off.
A gate with no configured tool, no execution evidence or an unreviewed failing finding is NOT passed. Choose relevant gates by project type; do not require browser checks for backend-only apps.
