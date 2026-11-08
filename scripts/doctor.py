#!/usr/bin/env python3
"""Offline, read-only project readiness check; no dependencies."""
import argparse, json, sys
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('project',nargs='?',default='.'); a=p.parse_args()
r=Path(a.project).expanduser().resolve()
if not r.is_dir(): p.error('Project directory does not exist')
checks=[('CLAUDE rules',r/'CLAUDE.md'),('Codex rules',r/'AGENTS.md'),('Claude agents',r/'.claude/agents'),('Claude skills',r/'.claude/skills'),('Project profile',r/'docs/PROJECT-PROFILE.md'),('Quality gates',r/'docs/QUALITY-GATES.md'),('Release checklist',r/'docs/DELIVERY-CHECKLIST.md')]
for name,path in checks: print(('OK' if path.exists() else 'MISSING').ljust(8),name)
profile=(r/'docs/PROJECT-PROFILE.md')
if profile.exists() and 'TBD' in profile.read_text(): print('INFO    Project profile contains placeholders; configure before delivery')
package=r/'package.json'
if package.exists():
 try:
  data=json.loads(package.read_text()); needed=['lint','typecheck','test:ci','build']; absent=[x for x in needed if x not in data.get('scripts',{})]
  print('NODE    '+('Missing CI scripts: '+', '.join(absent) if absent else 'Required CI scripts found'))
 except (ValueError,OSError): print('NODE    Unable to parse package.json')
if (r/'.github/workflows').exists(): print('INFO    Check existing workflows manually; this kit does not configure or validate them')
print('INFO    Doctor checks structure only; it does NOT certify delivery readiness or execute tests')
