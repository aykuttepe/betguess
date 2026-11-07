#!/usr/bin/env python3
"""Manual checklist evidence reminder, never auto-certifies a release."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('project',nargs='?',default='.');a=p.parse_args()
f=Path(a.project).expanduser().resolve()/'docs/DELIVERY-CHECKLIST.md'
if not f.is_file(): p.error('Delivery checklist missing')
t=f.read_text(); done=t.count('- [x]')+t.count('- [X]'); total=done+t.count('- [ ]')
print(f'Delivery checklist: {done}/{total} manually marked')
print('Evidence and approval must be independently verified; marking boxes is not proof.')
if total==0 or done<total: raise SystemExit(1)
