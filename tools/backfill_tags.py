#!/usr/bin/env python3
"""
Backfill Tags Scrip
Scans all Markdown posts, sanitizes their tags using the new contract, and updates them.
Supports --dry-run (default) and --apply.
"""

import argparse
import sys
import yaml
import glob
from pathlib import Path
from collections import Counter
import frontmatter

# Import path adjustment
# We need to add the directory containing 'news_collector' to sys.path
# 'tools' is at root/tools. 'news_collector' is at root/noticiencias_news_collector/news_collector? 
# Wait, checking repo structure: /home/cortega26/noticiencias_news_collector/news_collector
# The script is likely in /home/cortega26/noticiencias/tools/backfill_tags.py?
# Let's try to add the specific known path to the backend code.

BACKEND_ROOT = Path("/home/cortega26/noticiencias_news_collector")
if BACKEND_ROOT.exists():
    sys.path.append(str(BACKEND_ROOT))

try:
    from news_collector.taxonomy.normalizer import TagNormalizer
except ImportError as e:
    print(f"Import Error: {e}")
    # Fallback: try to import directly from source file if package fails
    # This is a bit hacky but works for standalone scripts
    sys.path.append(str(BACKEND_ROOT / "news_collector"))
    try:
         from taxonomy.normalizer import TagNormalizer
    except ImportError:
         print("CRITICAL: Could not import TagNormalizer. Check python path.")
         sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Backfill and sanitize tags in content.")
    parser.add_argument("--content-dir", default="src/content/posts", help="Path to content directory")
    parser.add_argument("--apply", action="store_true", help="Apply changes to files")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Don't change files, just report (Default)")
    
    args = parser.parse_args()
    
    # If Apply is set, disable text dry-run (but we keep boolean logic clear)
    if args.apply:
        args.dry_run = False
        print("⚠️  APPLY MODE ENABLED. FILES WILL BE MODIFIED. ⚠️")
    else:
        print("🔍 DRY RUN MODE. No files will be changed.")

    content_dir = Path(args.content_dir).resolve()
    if not content_dir.exists():
        print(f"Error: Content directory not found: {content_dir}")
        sys.exit(1)

    print(f"Loading normalizer...")
    normalizer = TagNormalizer()
    
    files = sorted(glob.glob(str(content_dir / "*.md")))
    print(f"Found {len(files)} files.")
    
    stats = {
        "processed": 0,
        "changed": 0,
        "tags_removed": Counter(),
        "tags_replaced": Counter(),
        "tags_merged": Counter(),
        "total_tags_before": 0,
        "total_tags_after": 0
    }
    
    for fpath in files:
        with open(fpath, "r", encoding="utf-8") as f:
            try:
                post = frontmatter.load(f)
            except Exception as e:
                print(f"Error parse {fpath}: {e}")
                continue
        
        original_tags = post.metadata.get("tags", [])
        if not original_tags:
            original_tags = []
        elif isinstance(original_tags, str):
            original_tags = [original_tags]
            
        stats["total_tags_before"] += len(original_tags)
        
        # Run Sanitizer
        result = normalizer.sanitize_tags(original_tags)
        new_tags = result.tags
        
        # Detect Change
        # We compare set-wise or list-wise? List-wise order matters in YAML usually
        has_changed = (new_tags != original_tags)
        
        if has_changed:
            stats["changed"] += 1
            stats["total_tags_after"] += len(new_tags)
            
            # Record audit stats
            for r in result.removed:
                stats["tags_removed"][r] += 1
            for r in result.replaced:
                stats["tags_replaced"][f"{r['from']}->{r['to']}"] += 1
            for r in result.merged:
                stats["tags_merged"][f"{r['dropped']}->{r['kept']}"] += 1
                
            if args.dry_run:
                print(f"[DRY-RUN] {Path(fpath).name}: {original_tags} -> {new_tags}")
                if result.warnings:
                    print(f"   Warnings: {result.warnings}")
            else:
                # Apply Change
                post.metadata["tags"] = new_tags
                # We need to write back preserving frontmatter
                # python-frontmatter dumps() does this
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(frontmatter.dumps(post))
                print(f"[UPDATED] {Path(fpath).name}")
        else:
             stats["total_tags_after"] += len(new_tags)
             
        stats["processed"] += 1
    
    print("\n--- Summary ---")
    print(f"Processed: {stats['processed']}")
    print(f"Changed:   {stats['changed']}")
    print(f"Total Tags: {stats['total_tags_before']} -> {stats['total_tags_after']}")
    
    print("\nTop 10 Removed:")
    for t, c in stats["tags_removed"].most_common(10):
        print(f"  {t}: {c}")

    print("\nTop 10 Replaced:")
    for t, c in stats["tags_replaced"].most_common(10):
        print(f"  {t}: {c}")
        
    print("\nTop 10 Merged:")
    for t, c in stats["tags_merged"].most_common(10):
        print(f"  {t}: {c}")

if __name__ == "__main__":
    main()
