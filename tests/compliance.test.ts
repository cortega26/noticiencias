
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Compliance & Security Suite', () => {
    const publicDir = path.join(__dirname, '../public');
    const headersFile = path.join(publicDir, '_headers');

    it('should have an OWASP-compliant _headers file', () => {
        expect(fs.existsSync(headersFile)).toBe(true);
        const content = fs.readFileSync(headersFile, 'utf-8');
        expect(content).toContain('X-Frame-Options: SAMEORIGIN');
        expect(content).toContain('X-Content-Type-Options: nosniff');
        expect(content).toContain('Strict-Transport-Security');
    });

    it('should have critical placeholder images', () => {
        const defaultImg = path.join(publicDir, 'assets/images/default.png');
        const heroImg = path.join(publicDir, 'assets/images/hero-image.png');

        expect(fs.existsSync(defaultImg)).toBe(true);
        expect(fs.existsSync(heroImg)).toBe(true);
    });

    it('should pass Codacy-style linting', () => {
        try {
            execSync('npm run lint', { stdio: 'ignore' });
        } catch (error) {
            throw new Error('Linting failed. Run "npm run lint" to see errors.');
        }
    });
});
