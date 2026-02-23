#!/usr/bin/env python3
"""
Heuristic table usage audit for bot_service ORM models.

The script reads `__tablename__` values from SQLAlchemy model classes and scans
backend Python files for model/table references. This is static analysis only.
"""

from __future__ import annotations

import argparse
import ast
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class TableUsage:
    table: str
    model: str
    model_file: Path
    model_refs: int
    table_refs: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root containing bot_service/",
    )
    parser.add_argument(
        "--out",
        default="",
        help="Optional output markdown file path",
    )
    parser.add_argument(
        "--low-used-model-refs",
        type=int,
        default=1,
        help="Threshold for model refs to consider table low-used",
    )
    parser.add_argument(
        "--low-used-table-refs",
        type=int,
        default=1,
        help="Threshold for table refs to consider table low-used",
    )
    return parser.parse_args()


def _iter_model_files(models_dir: Path) -> list[Path]:
    return sorted(path for path in models_dir.glob("*.py") if path.is_file())


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="strict")


def collect_tables(models_dir: Path) -> list[tuple[str, str, Path]]:
    tables: list[tuple[str, str, Path]] = []

    for model_file in _iter_model_files(models_dir):
        source = _read_text(model_file)
        tree = ast.parse(source, filename=str(model_file))
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue

            table_name: str | None = None
            for statement in node.body:
                if isinstance(statement, ast.Assign):
                    for target in statement.targets:
                        if isinstance(target, ast.Name) and target.id == "__tablename__":
                            if isinstance(statement.value, ast.Constant) and isinstance(statement.value.value, str):
                                table_name = statement.value.value
                elif isinstance(statement, ast.AnnAssign):
                    if isinstance(statement.target, ast.Name) and statement.target.id == "__tablename__":
                        value = statement.value
                        if isinstance(value, ast.Constant) and isinstance(value.value, str):
                            table_name = value.value

            if table_name:
                tables.append((table_name, node.name, model_file))

    return tables


def collect_source_files(bot_service_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in bot_service_dir.rglob("*.py"):
        if not path.is_file():
            continue
        if "alembic" in path.parts:
            continue
        if "__pycache__" in path.parts:
            continue
        files.append(path)
    return sorted(files)


def count_refs(
    table: str,
    model: str,
    model_file: Path,
    source_files: list[Path],
) -> tuple[int, int]:
    model_pattern = re.compile(rf"\b{re.escape(model)}\b")
    table_pattern = re.compile(rf"['\"]{re.escape(table)}['\"]")
    model_refs = 0
    table_refs = 0

    for path in source_files:
        if path == model_file:
            continue
        try:
            text = _read_text(path)
        except UnicodeError:
            continue
        model_refs += len(model_pattern.findall(text))
        table_refs += len(table_pattern.findall(text))

    return model_refs, table_refs


def build_usage_matrix(
    tables: list[tuple[str, str, Path]],
    source_files: list[Path],
) -> list[TableUsage]:
    rows: list[TableUsage] = []
    for table, model, model_file in tables:
        model_refs, table_refs = count_refs(table, model, model_file, source_files)
        rows.append(
            TableUsage(
                table=table,
                model=model,
                model_file=model_file,
                model_refs=model_refs,
                table_refs=table_refs,
            )
        )
    return sorted(rows, key=lambda row: row.table)


def render_markdown(
    rows: list[TableUsage],
    low_used_model_refs: int,
    low_used_table_refs: int,
    repo_root: Path,
) -> str:
    low_used = [
        row
        for row in rows
        if row.model_refs <= low_used_model_refs and row.table_refs <= low_used_table_refs
    ]

    lines: list[str] = []
    lines.append(f"# DB Table Usage Audit ({date.today().isoformat()})")
    lines.append("")
    lines.append("Static analysis only (source references). No destructive actions were performed.")
    lines.append("")
    lines.append("## Method")
    lines.append("")
    lines.append("- Source of tables: SQLAlchemy models with `__tablename__` in `bot_service/models/*.py`.")
    lines.append("- `model refs`: class-name matches outside the model file.")
    lines.append("- `table refs`: string literal table-name matches outside the model file.")
    lines.append("- Alembic files are excluded from counts.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Total ORM tables detected: {len(rows)}")
    lines.append(
        "- Potentially low-used tables (heuristic): "
        f"{len(low_used)} (model_refs <= {low_used_model_refs}, table_refs <= {low_used_table_refs})"
    )
    lines.append("")

    if low_used:
        lines.append("### Potentially Low-Used Tables")
        lines.append("")
        for row in low_used:
            lines.append(
                f"- `{row.table}` (`{row.model}`): model refs={row.model_refs}, table refs={row.table_refs}"
            )
        lines.append("")

    lines.append("## Full Table Reference Matrix")
    lines.append("")
    lines.append("| table | model | model refs | table refs | model file |")
    lines.append("|---|---:|---:|---:|---|")
    for row in rows:
        model_path = row.model_file.relative_to(repo_root).as_posix()
        lines.append(
            f"| `{row.table}` | `{row.model}` | {row.model_refs} | {row.table_refs} | `{model_path}` |"
        )

    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append("- Treat this report as a heuristic pre-filter, not a deletion list.")
    lines.append("- Confirm runtime usage with query logs or endpoint traces before dropping tables.")
    lines.append("- Remove confirmed obsolete tables only via Alembic migrations.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    repo_root = Path(args.root).resolve()
    bot_service_dir = repo_root / "bot_service"
    models_dir = bot_service_dir / "models"

    if not models_dir.exists():
        raise SystemExit(f"models directory not found: {models_dir}")

    tables = collect_tables(models_dir)
    source_files = collect_source_files(bot_service_dir)
    rows = build_usage_matrix(tables, source_files)
    report = render_markdown(
        rows=rows,
        low_used_model_refs=args.low_used_model_refs,
        low_used_table_refs=args.low_used_table_refs,
        repo_root=repo_root,
    )

    if args.out:
        out_path = (repo_root / args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"Wrote report: {out_path}")
    else:
        print(report)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
