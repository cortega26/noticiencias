import { describe, it, expect } from 'vitest';
import { SiteAuditor } from '../scripts/site-audit';
import * as path from 'path';
import * as fs from 'fs';

describe('Site Integrity Suite', () => {
    const distPath = path.join(__dirname, '../dist');

    // Fail if dist doesn't exist (build failed or not run)
    if (!fs.existsSync(distPath)) {
        throw new Error('Dist directory not found. Run npm run build first.');
    }

    const auditor = new SiteAuditor(distPath);

    it('should have no broken links, missing assets, or SEO issues', async () => {
        const errors = await auditor.runAudit();

        if (errors.length > 0) {
            console.error('\n❌ SITE INTEGRITY VIOLATIONS FOUND:\n');
            errors.forEach(e => {
                console.error(`[${e.type}] in ${e.file}: ${e.message}`);
            });
        }

        expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
    });
});
