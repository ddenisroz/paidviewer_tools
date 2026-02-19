from pathlib import Path

ROOTS = [Path('frontend/src'), Path('bot_service'), Path('tts_service'), Path('docs')]
ALLOWED_EXT = {'.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.css', '.scss', '.d.ts'}
SKIP_PARTS = {
    '.git', 'node_modules', '.venv', 'dist', 'build', '__pycache__',
    '.ruff_cache', '.pytest_cache', 'logs', 'f5_tts_cache', 'audio', 'temp', 'backups'
}
SKIP_FILES = {'package-lock.json'}
TOKENS = ['РвЂ', 'РЎ', 'СЏ', 'С‘', 'вЂ', 'Ð', 'Ñ', 'Ã', 'Â', '�', 'Рџ', 'Р°', 'Рё', 'С‚']


def token_score(s: str) -> int:
    return sum(s.count(t) for t in TOKENS)


def maybe_fix_line(line: str):
    if token_score(line) == 0:
        return line, False

    candidates = []
    for enc in ('cp1251', 'latin1'):
        try:
            fixed = line.encode(enc).decode('utf-8')
        except Exception:
            continue
        candidates.append(fixed)

    if not candidates:
        return line, False

    orig_score = token_score(line)
    best = line
    best_score = orig_score

    for c in candidates:
        s = token_score(c)
        if s < best_score:
            best = c
            best_score = s

    if best is not line and (orig_score - best_score) >= 2:
        return best, True
    return line, False


def iter_files():
    for root in ROOTS:
        if not root.exists():
            continue
        for p in root.rglob('*'):
            if not p.is_file():
                continue
            if any(part in SKIP_PARTS for part in p.parts):
                continue
            if p.name in SKIP_FILES:
                continue
            if p.suffix.lower() not in ALLOWED_EXT and not p.name.endswith('.d.ts'):
                continue
            yield p


def run(apply_changes: bool = False):
    files_scanned = 0
    files_changed = 0
    lines_changed = 0

    for path in iter_files():
        try:
            text = path.read_text(encoding='utf-8')
        except Exception:
            continue

        files_scanned += 1
        out_lines = []
        local_changes = 0

        for line in text.splitlines(keepends=True):
            core = line[:-2] if line.endswith('\r\n') else (line[:-1] if line.endswith('\n') else line)
            eol = '\r\n' if line.endswith('\r\n') else ('\n' if line.endswith('\n') else '')
            fixed, changed = maybe_fix_line(core)
            if changed:
                local_changes += 1
            out_lines.append(fixed + eol)

        if local_changes > 0:
            files_changed += 1
            lines_changed += local_changes
            if apply_changes:
                try:
                    path.write_text(''.join(out_lines), encoding='utf-8', newline='')
                except PermissionError:
                    pass

    print(f'SCANNED={files_scanned}')
    print(f'FILES_CHANGED={files_changed}')
    print(f'LINES_CHANGED={lines_changed}')


if __name__ == '__main__':
    import sys
    apply_flag = '--apply' in sys.argv
    run(apply_changes=apply_flag)
