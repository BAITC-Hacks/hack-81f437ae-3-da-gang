"""Scan publishable files without printing credentials or their contents."""
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'.git', '.tools', '.pgdata', '.venv', 'node_modules', '__pycache__',
             '.pytest_cache', 'test-results', 'playwright-report'}
TOKEN = re.compile(r'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b')


def scan(root=ROOT):
    findings = []
    for directory, subdirs, files in os.walk(root):
        subdirs[:] = [d for d in subdirs if d not in SKIP_DIRS]
        for name in files:
            if name == '.env' or (name.startswith('.env.') and name != '.env.example'):
                continue
            path = Path(directory) / name
            # Skip non-text artifacts; built JavaScript and HTML are scanned too.
            try:
                content = path.read_text(encoding='utf-8-sig')
            except UnicodeError:
                continue
            for number, line in enumerate(content.splitlines(), 1):
                if TOKEN.search(line):
                    findings.append(f'{path.relative_to(root)}:{number}: possible API key')
                elif name == '.env.example' and re.match(r'^\s*OPENAI_API_KEY\s*=\s*\S+', line):
                    findings.append(f'{path.relative_to(root)}:{number}: template key must be empty')
    return findings


def main():
    findings = scan()
    try:
        git = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '-z'], capture_output=True, check=False)
        if git.returncode == 0:
            for raw in git.stdout.decode('utf-8').split('\0'):
                name = Path(raw).name
                if name == '.env' or (name.startswith('.env.') and name != '.env.example'):
                    findings.append(f'{raw}: environment file is tracked by Git')
            print('Git tracked environment files: checked (history is not scanned).')
        else:
            print('No Git repository: tracked files/history cannot be audited; no repository was created.')
    except FileNotFoundError:
        print('Git unavailable: tracked files/history not checked.')
    for finding in findings:
        print(finding)
    print(f'Publishable source/build files: {len(findings)} findings. Secret values are never printed.')
    return 1 if findings else 0


if __name__ == '__main__':
    raise SystemExit(main())
