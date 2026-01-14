#!/bin/bash
# scripts/lint_liquid.sh
# Checks for common Liquid syntax errors

grep -r "{% -" . --include=*.html --include=*.md
if [ $? -eq 0 ]; then
  echo "Error: Found invalid Liquid tag '{% -' (should be '{%-')."
  exit 1
fi

echo "Liquid lint passed (no '{% -' found)."
exit 0
