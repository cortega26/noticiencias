
import sys
sys.path.append("/home/cortega26/noticiencias_news_collector")

import os
import re
import json
import logging
from pathlib import Path
# We need to ensure we can import the module. 
# Also might need to setup environment variables if config depends on them.
os.environ["NEWS_COLLECTOR_PATH"] = "/home/cortega26/noticiencias_news_collector"

from news_collector.components.editorial.ai_editor import EditorAgent

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("BackfillTags")

POSTS_DIR = Path("/home/cortega26/noticiencias/src/content/posts")

def get_frontmatter(content):
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return None, None
    return match.group(1), match.end()

def parse_yaml(fm_str):
    data = {}
    for line in fm_str.split("\n"):
        if ":" in line:
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip()
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            elif val.startswith("[") and val.endswith("]"):
                 try:
                     val = json.loads(val)
                 except Exception:
                     pass
            data[key] = val
    return data

def main():
    # Initialize Editor Agent (we only need it for headlines/tags generation logic)
    # Using defaults from config would be better, but hardcoding for script simplicity
    # assuming Ollama is at localhost:11434
    
    # We need to mock the config loading or just instantiate carefully
    try:
        editor = EditorAgent(
            api_url="http://localhost:11434",
            model="llama3.2:latest", # Or whatever is default
            headlines_model="llama3.2:latest"
        )
    except Exception as e:
        logger.error(f"Failed to init EditorAgent: {e}")
        return

    files = sorted(list(POSTS_DIR.glob("*.md")))
    logger.info(f"Found {len(files)} articles.")

    for file_path in files:
        logger.info(f"Processing {file_path.name}...")
        try:
            content = file_path.read_text()
            fm_str, end_idx = get_frontmatter(content)
            
            if not fm_str:
                logger.warning(f"Skipping {file_path.name}: No frontmatter found.")
                continue

            # Check if tags already exist and are not empty
            # Simple check string based to avoid full yaml parse if possible
            if "tags: [" in fm_str and "tags: []" not in fm_str:
                 # Check if it has actual content. "tags: []" is empty.
                 # "tags: ["some"]" is not.
                 # Also check for "other" or single generic tags if we want to overwrite them?
                 # For now, only backfill empty tags.
                 logger.info(f"Skipping {file_path.name}: Tags already present.")
                 continue
            
            # If tags line missing or empty strings
            
            body = content[end_idx:].strip()
            
            # Use EditorAgent to generate tags
            # We reuse _generate_headlines logic but we only want tags really.
            # But changing the method signature of _generate_headlines might be invasive.
            # Let's just call it and extract tags.
            
            try:
                # We need to simulate 'adapted_content' roughly. 
                # The body is markdown.
                headlines = editor._generate_headlines(body[:3000]) # Limit context
                tags = headlines.get("tags", [])
                
                if not tags:
                    logger.warning(f"No tags generated for {file_path.name}")
                    continue
                    
                logger.info(f"Generated tags for {file_path.name}: {tags}")
                
                # Update Frontmatter
                # We need to replace the tags line or add it.
                # ensure_ascii=False to avoid \u escapes which confuse regex
                new_tags_line = f'tags: {json.dumps(tags, ensure_ascii=False)}'
                
                # Regex replace - escape backslashes just in case, though ensure_ascii=False helps
                # safely escaping the replacement string requires care, but with utf-8 it should be fine.
                if re.search(r"^tags:.*$", fm_str, re.MULTILINE):
                    # We use a lambda to avoid backslash interpretation issues in the replacement string
                    new_fm_str = re.sub(r"^tags:.*$", lambda m: new_tags_line, fm_str, flags=re.MULTILINE)
                else:
                    new_fm_str = fm_str + "\n" + new_tags_line
                
                new_content = f"---\n{new_fm_str}\n---{content[end_idx:]}"
                file_path.write_text(new_content)
                logger.info(f"Updated {file_path.name}")
                
            except Exception as e:
                logger.error(f"Failed to generate/update tags for {file_path.name}: {e}")

        except Exception as ex:
             logger.error(f"Error processing file {file_path.name}: {ex}")

if __name__ == "__main__":
    main()
