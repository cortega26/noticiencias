from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SCRIPT_RE = re.compile(
    r'<script type="application/ld\+json">(.*?)</script>', re.DOTALL
)
REQUIRED_FIELDS = {
    "@context",
    "@type",
    "headline",
    "datePublished",
    "author",
    "publisher",
    "image",
    "mainEntityOfPage",
}


def _extract_jsonld(html: str) -> list[dict]:
    items: list[dict] = []
    for match in SCRIPT_RE.finditer(html):
        payload = match.group(1).strip()
        if not payload:
            continue
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            items.append(data)
        elif isinstance(data, list):
            items.extend([item for item in data if isinstance(item, dict)])
    return items


def _validate_news_article(path: Path, data: dict) -> list[str]:
    errors: list[str] = []
    missing = [field for field in REQUIRED_FIELDS if field not in data]
    if missing:
        errors.append(f"{path}: missing fields in NewsArticle JSON-LD: {missing}")
    if data.get("@type") != "NewsArticle":
        errors.append(f"{path}: @type is not NewsArticle")
    if not data.get("headline"):
        errors.append(f"{path}: headline is empty")
    if not data.get("datePublished"):
        errors.append(f"{path}: datePublished is empty")
    author = data.get("author") or {}
    if isinstance(author, dict) and not author.get("name"):
        errors.append(f"{path}: author.name is empty")
    image = data.get("image") or {}
    if isinstance(image, dict) and not image.get("url"):
        errors.append(f"{path}: image.url is empty")
    return errors


def validate_site(site_dir: Path) -> int:
    errors: list[str] = []
    html_files = list(site_dir.rglob("*.html"))
    if not html_files:
        print(f"No HTML files found under {site_dir}.")
        return 2

    for html_path in html_files:
        text = html_path.read_text(encoding="utf-8")
        for data in _extract_jsonld(text):
            if data.get("@type") == "NewsArticle":
                errors.extend(_validate_news_article(html_path, data))

    if errors:
        print("JSON-LD validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("JSON-LD validation passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate JSON-LD NewsArticle blocks in built site."
    )
    parser.add_argument(
        "--site",
        type=Path,
        default=None,
        help="Path to built site directory (defaults to _site).",
    )
    args = parser.parse_args()
    site_dir = args.site.resolve() if args.site else Path("_site").resolve()

    if not site_dir.exists():
        print(f"Missing site directory at {site_dir}.")
        return 2

    return validate_site(site_dir)


if __name__ == "__main__":
    sys.exit(main())
