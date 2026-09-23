import importlib.util
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('secret_check', ROOT / 'scripts/check_secrets.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def test_publishable_files_have_no_keys():
    assert checker.scan(ROOT) == []


def test_scanner_reports_location_not_value(tmp_path):
    fake = 'sk-' + 'x' * 40
    (tmp_path / '.env').write_text('OPENAI_API_KEY=' + fake)
    (tmp_path / 'leak.py').write_text('key=' + fake)
    findings = checker.scan(tmp_path)
    assert len(findings) == 1 and 'leak.py:1' in findings[0]
    assert fake not in findings[0]


def test_gitignore_excludes_local_credentials(tmp_path):
    if not shutil.which('git'):
        import pytest
        pytest.skip('git not installed')
    # A disposable repository tests the actual ignore rules without initializing the project.
    subprocess.run(['git', 'init', '-q', str(tmp_path)], check=True)
    shutil.copyfile(ROOT / '.gitignore', tmp_path / '.gitignore')
    ignored = subprocess.run(['git', '-C', str(tmp_path), 'check-ignore', '.env', '.env.local', '.env.example'], capture_output=True, text=True, check=False)
    assert set(ignored.stdout.splitlines()) == {'.env', '.env.local'}
