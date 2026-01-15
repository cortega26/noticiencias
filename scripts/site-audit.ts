import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { globSync } from 'glob';

interface IntegrityError {
    file: string;
    type: 'BROKEN_LINK' | 'MISSING_IMAGE' | 'SEO_MISSING' | 'PERFORMANCE';
    message: string;
}

export class SiteAuditor {
    private distPath: string;
    private errors: IntegrityError[] = [];
    private validInternalLinks = new Set<string>();

    constructor(distPath: string) {
        this.distPath = path.resolve(distPath);
    }

    public async runAudit(): Promise<IntegrityError[]> {
        this.errors = [];
        const htmlFiles: string[] = globSync('**/*.html', { cwd: this.distPath });

        // 1. Build Index of all valid pages for internal link checking
        htmlFiles.forEach((file: string) => {
            // /about/index.html -> /about/
            // /index.html -> /
            let url = '/' + (typeof file === 'string' ? file : String(file)).replace(/index\.html$/, '').replace(/\.html$/, '');
            if (url.length > 1 && url.endsWith('/')) {
                url = url.slice(0, -1); // normalize trailing slash issues if any
            }
            if (url === '') url = '/';

            // Also add the exact file path as a valid target for some static assets
            this.validInternalLinks.add(url);

            // Add variations with and without trailing slash to be safe
            if (url !== '/') {
                this.validInternalLinks.add(url + '/');
                this.validInternalLinks.add(url.replace(/\/$/, ''));
            }
        });

        // 2. Scan each file
        for (const file of htmlFiles) {
            const filePath = path.join(this.distPath, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const $ = cheerio.load(content);
            // const pageUrl = '/' + file;

            // Check SEO
            this.checkSEO($, file);

            // Check Links
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (typeof href === 'string') this.checkLink(href, file);
            });

            // Check Images
            $('img').each((_, el) => {
                const src = $(el).attr('src');
                if (typeof src === 'string') this.checkImage(src, file);
            });
        }

        return this.errors;
    }

    private checkSEO($: cheerio.CheerioAPI, file: string) {
        if (!$('title').text()) {
            this.errors.push({ file, type: 'SEO_MISSING', message: 'Missing <title> tag' });
        }
        // Only check meta description if it's not a pagination page (optional rule, but good for integrity)
        const metaDesc = $('meta[name="description"]').attr('content');
        if (typeof metaDesc !== 'string' || !metaDesc) {
            this.errors.push({ file, type: 'SEO_MISSING', message: 'Missing meta description' });
        }
        const canonical = $('link[rel="canonical"]').attr('href');
        if (typeof canonical !== 'string' || !canonical) {
            this.errors.push({ file, type: 'SEO_MISSING', message: 'Missing canonical URL' });
        }
    }

    private checkLink(href: string, file: string) {
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        // Internal Links
        if (href.startsWith('/')) {
            // Strip query params and hash
            const cleanHref = href.split('?')[0].split('#')[0];

            // Check availability
            // 1. Check in our set of valid pages
            // 2. Check if it is a static file (css, js, png)
            if (!this.validInternalLinks.has(cleanHref)) {
                const staticPath = path.join(this.distPath, cleanHref);
                if (!fs.existsSync(staticPath)) {
                    this.errors.push({ file, type: 'BROKEN_LINK', message: `Internal link not found: ${href}` });
                }
            }
        }
    }

    private checkImage(src: string, file: string) {
        if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) return; // Skip external/base64 for now

        const cleanSrc = src.split('?')[0];
        const imagePath = path.join(this.distPath, cleanSrc);

        if (!fs.existsSync(imagePath)) {
            this.errors.push({ file, type: 'MISSING_IMAGE', message: `Image not found: ${src}` });
        }
    }
}
