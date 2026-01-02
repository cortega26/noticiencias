from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

KEY_RE = re.compile(r"^\s*([A-Za-z0-9_-]+)\s*:(.*)$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _parse_frontmatter(lines: list[str]) -> tuple[list[str], int] | None:
    if not lines or lines[0].strip() != "---":
        return None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            return lines[1:idx], idx
    return None


def _strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1].strip()
    return value


def _resolve_image_path(root: Path, post_path: Path, image_value: str) -> Path:
    if image_value.startswith("./") or image_value.startswith("../"):
        return (post_path.parent / image_value).resolve()
    if image_value.startswith("/"):
        return (root / image_value.lstrip("/")).resolve()
    return (root / image_value).resolve()


def validate_posts(root: Path, posts_dir: Path) -> int:
    errors: list[str] = []
    warnings: list[str] = []
    post_files = sorted(
        list(posts_dir.rglob("*.md")) + list(posts_dir.rglob("*.markdown"))
    )

    if not post_files:
        warnings.append(f"No posts found under {posts_dir}.")
        return _report(errors, warnings)

    for post in post_files:
        text = post.read_text(encoding="utf-8")
        lines = text.splitlines()
        frontmatter = _parse_frontmatter(lines)
        if frontmatter is None:
            errors.append(f"{post}: missing YAML front matter block")
            continue

        fm_lines, _ = frontmatter
        keys: dict[str, str] = {}

        for line in fm_lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            match = KEY_RE.match(line)
            if not match:
                continue
            key, value = match.group(1), match.group(2)
            if any(ch.isupper() for ch in key):
                errors.append(f"{post}: front matter key '{key}' must be lowercase")
            key_lower = key.lower()
            if key_lower in keys:
                warnings.append(f"{post}: duplicate key '{key_lower}'")
            keys[key_lower] = value.strip()

        for required in ("title", "author", "date"):
            if required not in keys:
                errors.append(f"{post}: missing required key '{required}'")

        date_value = _strip_quotes(keys.get("date", ""))
        if date_value and not DATE_RE.match(date_value):
            errors.append(
                f"{post}: date '{date_value}' must start with YYYY-MM-DD"
            )

        image_value = _strip_quotes(keys.get("image", ""))
        if image_value:
            if not re.match(r"^https?://", image_value):
                image_path = _resolve_image_path(root, post, image_value)
                if not image_path.exists():
                    errors.append(
                        f"{post}: image '{image_value}' not found at {image_path}"
                    )

    return _report(errors, warnings)


def _report(errors: list[str], warnings: list[str]) -> int:
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")
        print("")

    if errors:
        print("Front matter validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Front matter validation passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate YAML front matter in _posts."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root (defaults to project root).",
    )
    args = parser.parse_args()

    root = args.root.resolve() if args.root else Path(__file__).resolve().parents[1]
    posts_dir = root / "_posts"
    if not posts_dir.exists():
        print(f"Missing _posts directory at {posts_dir}.")
        return 2

    return validate_posts(root, posts_dir)


if __name__ == "__main__":
    sys.exit(main())
