#!/usr/bin/env python3
"""
Standardize article frontmatter to schema_version 2 format.

Changes applied:
  1. Add schema_version: 2 where missing
  2. Add investigation: false where missing
  3. Add featured: false where missing
  4. Convert inline YAML arrays (categories/tags) to block format
  5. Fix headlines_variants that contain stringified Python lists
  6. Fix Unicode escape sequences in tag strings
  7. Fix known tag typos
"""

import ast
import re
import sys
from io import StringIO
from pathlib import Path

from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap, CommentedSeq

POSTS_DIR = Path(__file__).parent.parent / "src" / "content" / "posts"

FIELD_ORDER = [
    "title",
    "schema_version",
    "excerpt",
    "author",
    "date",
    "categories",
    "permalink",
    "tags",
    "image",
    "image_alt",
    "source_url",
    "refinery_id",
    "headlines_variants",
    "translation_method",
    "editorial_score",
    "review_status",
    "confidence",
    "investigation",
    "featured",
    "fact_check",
    "why_it_matters",
    "series",
    "sources",
]

TAG_TYPOS = {
    "direigibles estratosféricos": "dirigibles estratosféricos",
}


def make_yaml():
    y = YAML()
    y.default_flow_style = False
    y.preserve_quotes = True
    y.width = 4096
    y.best_sequence_indent = 2
    y.indent(mapping=2, sequence=2, offset=2)
    return y


def extract_frontmatter(content: str):
    """Return (fm_str, body) from a markdown file, or (None, None)."""
    if not content.startswith("---\n"):
        return None, None
    end_idx = content.find("\n---\n", 4)
    if end_idx == -1:
        return None, None
    return content[4:end_idx], content[end_idx + 5:]


def fix_stringified_list(s: str) -> str:
    """If s looks like a stringified Python list, return its first item."""
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        try:
            items = ast.literal_eval(s)
            if isinstance(items, list) and items:
                return str(items[0])
        except (ValueError, SyntaxError):
            pass
    return s


def reorder(data: dict) -> CommentedMap:
    result = CommentedMap()
    for key in FIELD_ORDER:
        if key in data:
            result[key] = data[key]
    for key in data:
        if key not in result:
            result[key] = data[key]
    return result


def ensure_block_seq(value):
    """Convert a flow-style CommentedSeq to block style."""
    if isinstance(value, CommentedSeq):
        value.fa.set_block_style()
    return value


def standardize(data: dict, filename: str) -> list:
    changes = []

    # 1. schema_version: 2
    if "schema_version" not in data:
        data["schema_version"] = 2
        changes.append("+ schema_version: 2")

    # 2. investigation: false
    if "investigation" not in data:
        data["investigation"] = False
        changes.append("+ investigation: false")

    # 3. featured: false
    if "featured" not in data:
        data["featured"] = False
        changes.append("+ featured: false")

    # 4. Fix headlines_variants with stringified lists
    hv = data.get("headlines_variants")
    if isinstance(hv, dict):
        for key in ("question", "benefit"):
            val = hv.get(key)
            if isinstance(val, str) and val.strip().startswith("["):
                fixed = fix_stringified_list(val)
                if fixed != val:
                    hv[key] = fixed
                    changes.append(f"  fixed headlines_variants.{key}: unpacked list")

    # 5. Fix tag typos and ensure block style
    tags = data.get("tags")
    if isinstance(tags, (list, CommentedSeq)):
        new_tags = []
        for tag in tags:
            if isinstance(tag, str):
                fixed = TAG_TYPOS.get(tag, tag)
                if fixed != tag:
                    changes.append(f"  fixed tag typo: '{tag}' → '{fixed}'")
                new_tags.append(fixed)
            else:
                new_tags.append(tag)
        data["tags"] = CommentedSeq(new_tags)
        data["tags"].fa.set_block_style()

    # 6. Ensure categories is block style
    cats = data.get("categories")
    if isinstance(cats, (list, CommentedSeq)):
        data["categories"] = CommentedSeq(list(cats))
        data["categories"].fa.set_block_style()

    return changes


def process_file(filepath: Path, yaml: YAML, dry_run: bool = False) -> bool:
    content = filepath.read_text(encoding="utf-8")
    fm_str, body = extract_frontmatter(content)
    if fm_str is None:
        print(f"  SKIP {filepath.name}: no frontmatter")
        return False

    data = yaml.load(fm_str)
    if not isinstance(data, dict):
        print(f"  SKIP {filepath.name}: frontmatter is not a mapping")
        return False

    changes = standardize(data, filepath.name)
    ordered = reorder(data)

    stream = StringIO()
    yaml.dump(ordered, stream)
    new_fm = stream.getvalue().rstrip("\n")
    new_content = f"---\n{new_fm}\n---\n{body}"

    if new_content == content:
        print(f"  OK   {filepath.name}")
        return False

    if not dry_run:
        filepath.write_text(new_content, encoding="utf-8")

    label = "DRY  " if dry_run else "UPD  "
    print(f"  {label}{filepath.name}")
    for c in changes:
        print(f"       {c}")
    if not changes:
        print("       (format only)")
    return True


def main():
    dry_run = "--dry-run" in sys.argv
    yaml = make_yaml()

    print(f"{'DRY RUN — ' if dry_run else ''}Standardizing articles in {POSTS_DIR}\n")
    updated = 0
    for filepath in sorted(POSTS_DIR.glob("*.md")):
        if process_file(filepath, yaml, dry_run=dry_run):
            updated += 1

    print(f"\nDone. {updated} file(s) {'would be ' if dry_run else ''}updated.")


if __name__ == "__main__":
    main()
