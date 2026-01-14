import csv
import re

# Read sitemap
try:
    with open('_site/sitemap.xml', 'r') as f:
        content = f.read()

    # Simple regex to find loc (assuming standard sitemap format)
    urls = re.findall(r'<loc>(.*?)</loc>', content)

    # Write to CSV
    with open('URL_PARITY_REPORT.csv', 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['url'])
        for url in urls:
            writer.writerow([url])

    print(f"Extracted {len(urls)} URLs to URL_PARITY_REPORT.csv")

except FileNotFoundError:
    print("Error: _site/sitemap.xml not found.")
except Exception as e:
    print(f"Error: {e}")
