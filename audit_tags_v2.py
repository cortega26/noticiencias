import os
import yaml
from collections import Counter

CONTENT_DIR = '/home/cortega26/noticiencias/src/content/posts'

categories = Counter()
tags = Counter()
other_candidates = []

print(f"Scanning {CONTENT_DIR}...")

try:
    files = os.listdir(CONTENT_DIR)
except FileNotFoundError:
    print(f"Directory not found: {CONTENT_DIR}")
    files = []

for filename in files:
    if not filename.endswith('.md'):
        continue
    
    filepath = os.path.join(CONTENT_DIR, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        parts = content.split('---')
        if len(parts) < 3:
            # print(f"Skipping {filename}: Invalid frontmatter format")
            continue
            
        # Parse YAML frontmatter
        try:
            metadata = yaml.safe_load(parts[1])
        except yaml.YAMLError as e:
            print(f"Error parsing YAML in {filename}: {e}")
            continue
            
        if not isinstance(metadata, dict):
            continue

        # Check categories
        cats = metadata.get('categories', [])
        if isinstance(cats, str):
            cats = [cats]
        elif cats is None:
            cats = []
            
        for c in cats:
            categories[c] += 1
            if c == "Other":
                other_candidates.append((filename, "category", c))
                
        # Check tags
        tgs = metadata.get('tags', [])
        if isinstance(tgs, str):
            tgs = [tgs]
        elif tgs is None:
            tgs = []
            
        for t in tgs:
            tags[t] += 1
            if t == "Other":
                other_candidates.append((filename, "tag", t))
                
    except Exception as e:
        print(f"Error processing {filename}: {e}")

print("\n--- Categories ---")
for c, count in categories.most_common():
    print(f"'{c}': {count}")

print("\n--- Tags ---")
print(f"Total Unique Tags: {len(tags)}")
for t, count in tags.most_common(50): # Top 50 tags
    print(f"'{t}': {count}")

print(f"\nTotal 'Other' candidates: {len(other_candidates)}")
for fname, field, val in other_candidates:
    print(f"{fname}: {field}={val}")
