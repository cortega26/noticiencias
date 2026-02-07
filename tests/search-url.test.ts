import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getQueryFromUrl, updateUrlWithQuery } from '../src/utils/search-url.ts';

describe('Search URL Utils', () => {
    
    beforeEach(() => {
        // Mock global window and history
        const url = new URL('http://localhost/buscar');
        
        vi.stubGlobal('window', {
            location: {
                search: '',
                href: 'http://localhost/buscar',
                toString: () => 'http://localhost/buscar'
            },
            history: {
                pushState: vi.fn(),
            }
        });

        vi.stubGlobal('location', window.location);
        vi.stubGlobal('history', window.history);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getQueryFromUrl', () => {
        it('should return empty string if no query param', () => {
            window.location.search = '';
            expect(getQueryFromUrl()).toBe('');
        });

        it('should return correct query value', () => {
            window.location.search = '?q=astro';
            expect(getQueryFromUrl()).toBe('astro');
        });

        it('should trim whitespace', () => {
            window.location.search = '?q=  star  ';
            expect(getQueryFromUrl()).toBe('star');
        });

        it('should handle manual input string', () => {
            expect(getQueryFromUrl('?q=manual')).toBe('manual');
        });
    });

    describe('updateUrlWithQuery', () => {
        it('should update URL with query param', () => {
            updateUrlWithQuery('nebula');
            expect(window.history.pushState).toHaveBeenCalledWith(
                expect.any(Object),
                '',
                expect.stringContaining('?q=nebula')
            );
        });

        it('should remove query param if empty', () => {
             // Setup initial state
             window.location.href = 'http://localhost/buscar?q=old';
             
             updateUrlWithQuery('');
             
             // Check that 'q' is gone
             const calls = (window.history.pushState as any).mock.calls;
             const newUrl = calls[0][2];
             expect(newUrl).not.toContain('?q=');
             expect(newUrl).toBe('http://localhost/buscar');
        });

        it('should replace spaces with + or %20 (URL encoding)', () => {
            updateUrlWithQuery('black hole');
            const calls = (window.history.pushState as any).mock.calls;
            const newUrl = calls[0][2];
            expect(newUrl).toMatch(/q=black(\+|%20)hole/);
        });
    });
});
