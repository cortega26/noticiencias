import csv
import re
import os

# Path to sitemap
sitemap_path = 'dist/sitemap-0.xml'
output_path = 'migration/URL_INVENTORY.csv'

if not os.path.exists(sitemap_path):
    print(f"Error: {sitemap_path} not found. Please run 'npm run build' first if needed, or check dist folder.")
    exit(1)

try:
    with open(sitemap_path, 'r') as f:
        content = f.read()

    # Regex to find loc
    urls = re.findall(r'<loc>(.*?)</loc>', content)

    # Write to CSV
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['url'])
        for url in urls:
            writer.writerow([url])

    print(f"Success: Extracted {len(urls)} URLs to {output_path}")

except Exception as e:
    print(f"Error: {e}")
