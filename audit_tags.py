import os
import frontmatter
from collections import Counter

CONTENT_DIR = '/home/cortega26/noticiencias/src/content/posts'

categories = Counter()
tags = Counter()
other_candidates = []

print(f"Scanning {CONTENT_DIR}...")
files = os.listdir(CONTENT_DIR)
for filename in files:
    if not filename.endswith('.md'):
        continue
    
    filepath = os.path.join(CONTENT_DIR, filename)
    try:
        post = frontmatter.load(filepath)
        
        # Check categories
        cats = post.metadata.get('categories', [])
        if isinstance(cats, str):
            cats = [cats]
        elif cats is None:
            cats = []
            
        for c in cats:
            categories[c] += 1
            if c == "Other":
                other_candidates.append((filename, "category", c))
                
        # Check tags
        tgs = post.metadata.get('tags', [])
        if isinstance(tgs, str):
            tgs = [tgs]
        elif tgs is None:
            tgs = []
            
        for t in tgs:
            tags[t] += 1
            if t == "Other":
                other_candidates.append((filename, "tag", t))
                
    except Exception as e:
        # print(f"Error reading {filename}: {e}")
        pass

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
