# Security baseline
Use least privilege, no production credentials in local agent context or Git, separate staging/production, explicit approval for external network and deployment. Rotate any exposed secret immediately using provider mechanisms.
For web apps assess OWASP ASVS as applicable: authorization per object, session/authentication, input validation, injection, SSRF, CSRF, rate limiting, data retention, error disclosure, logging hygiene.
Scanners reduce risk but do not prove absence of vulnerabilities. Triage false positives; record accepted risks with rationale and owner.
