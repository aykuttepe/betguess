# Release runbook (template; never deploy automatically)
## Preconditions
Approved change, passing CI and security review, staging test evidence, release owner and maintenance window if needed.
## Before release
Confirm immutable artifact/version, environment configuration, schema compatibility, backups AND test restore when required. List smoke checks.
## Deployment
Use the project's approved manual or protected release process. Record commit SHA, version, actor and timestamp.
## Verification
Health/readiness, logs, error rate, synthetic workflows, user-facing critical journeys. Establish observation window and rollback triggers.
## Rollback
Document exact prior artifact, reversibility of migrations, restore strategy, decision maker, and expected data effects. Never assume DB downgrade is safe.
## Handover
Provide changelog, environment setup, admin/runbook, support contacts, known issues and acceptance record.
