import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeQuery } from '../src/utils/search-url.ts';
// We mock Lunr since it's loaded via CDN in the real app, but for tests we want to verify logic.
// In a real environment we might install lunr as a devDependency.
// For this integration test, we will simulate the logic used in buscar.astro

import lunr from 'lunr';

describe('Search Integration', () => {
    let index: any;
    let store: any = {};
    
    // Sample Data (Mocking what search.json.js returns)
    const mockDocuments = [
        {
            title: "Energía Oscura y el Universo",
            url: "/posts/energia-oscura",
            description: "Un estudio sobre la expansión.",
            content: "Contenido detallado sobre física.",
            tags: ["física", "espacio"],
            image: "img1.jpg"
        },
        {
            title: "Avances en IA",
            url: "/posts/ai-advances",
            description: "Inteligencia Artificial moderna.",
            content: "Redes neuronales y LLMs.",
            tags: ["tecnología", "ia"],
            image: "img2.jpg"
        }
    ];

    beforeEach(() => {
        store = {};
        // Simulate Index Building (Logic from buscar.astro)
        index = lunr(function (this: any) {
            this.ref('url');
            this.field('title', { boost: 10 });
            this.field('description', { boost: 5 });
            this.field('content');
            this.field('tags');
            
            mockDocuments.forEach(doc => {
                 // Normalize fields for better matching (Logic from buscar.astro)
                 const normalizedDoc = {
                    ...doc,
                    title: normalizeQuery(doc.title),
                    description: normalizeQuery(doc.description),
                    content: normalizeQuery(doc.content),
                    tags: doc.tags ? normalizeQuery(doc.tags.join(' ')) : ''
                };
                
                this.add(normalizedDoc);
                store[doc.url] = doc;
            });
        });
    });

    it('should find results using normalized query', () => {
        const query = "energía";
        const normalizedQuery = normalizeQuery(query); // "energia"
        
        const results = index.search(`${normalizedQuery}*`);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].ref).toBe('/posts/energia-oscura');
    });

    it('should find results regardless of case', () => {
        const query = "OSCURA";
        const normalizedQuery = normalizeQuery(query); // "oscura"
        
        const results = index.search(`${normalizedQuery}*`);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].ref).toBe('/posts/energia-oscura');
    });
    
    it('should find results from tags', () => {
        const query = "Tecnología";
        const normalizedQuery = normalizeQuery(query); // "tecnologia"

        const results = index.search(`${normalizedQuery}*`);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].ref).toBe('/posts/ai-advances');
    });

    it('should return empty for no matches', () => {
        const query = "Gastronomía";
        const normalizedQuery = normalizeQuery(query); 

        const results = index.search(`${normalizedQuery}*`);
        
        expect(results.length).toBe(0);
    });
});
