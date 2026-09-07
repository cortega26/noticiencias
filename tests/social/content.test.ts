import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import {
  GENERATOR_VERSION,
  PLATFORMS,
  SocialContentError,
  makeSocialPost,
  normalizeText,
  truncate,
} from '../../scripts/social/content.js';
import { PLATFORM_ORDER } from '../../scripts/social/article.js';

/**
 * Plan social-distribution §10 / §12 / §20.7–9: deterministic per-network copy.
 *
 * These tests check observable properties and independently-derived expected
 * results — they never call the module's own serializer/segmenter to compute
 * what they then assert (plan §20 "no reproduzcas el algoritmo dentro del
 * test").
 */

const CANONICAL = 'https://noticiencias.com/ciencia/2026-08-28-eclipse-solar/';

/** Local grapheme counter for assertions — Intl.Segmenter, not String#length. */
const seg = new Intl.Segmenter('es', { granularity: 'grapheme' });
const graphemeCount = (s: string): number => [...seg.segment(s)].length;
const utf8 = (s: string): number => Buffer.byteLength(s, 'utf8');
const codePoints = (s: string): number => [...s].length;

function baseArticle(over: Record<string, unknown> = {}) {
  return {
    title: 'Los físicos miden el eclipse solar',
    description: 'Un estudio internacional describe la duración total del fenómeno.',
    canonical_url: CANONICAL,
    ...over,
  };
}

// -------------------------------------------------------------------------
// normalizeText
// -------------------------------------------------------------------------

describe('normalizeText', () => {
  it('trims ends and collapses internal whitespace runs to single spaces', () => {
    expect(normalizeText('  hola   \t  mundo \n ')).toBe('hola mundo');
  });

  it('turns newlines and tabs between words into a single space', () => {
    expect(normalizeText('línea uno\n\n\tlínea dos')).toBe('línea uno línea dos');
  });

  it('drops non-whitespace control characters without fusing neighbours', () => {
    expect(normalizeText('a\u0000b\u0007c')).toBe('abc');
    expect(normalizeText('a\u0001 \u0002b')).toBe('a b');
  });

  it('is NFC: composed and decomposed inputs normalize equal', () => {
    const decomposed = 'cafe\u0301 sen\u0303or';
    const composed = 'caf\u00e9 se\u00f1or';
    expect(normalizeText(decomposed)).toBe(normalizeText(composed));
    expect(normalizeText(decomposed)).toBe('café señor');
  });

  it('preserves editorial emoji, skin tone, ZWJ families, flags and lone combining marks', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
    const flag = '\u{1F1E8}\u{1F1F1}';
    const samples = [
      'pulgar \u{1F44D}\u{1F3FD}',
      `familia ${family}`,
      `bandera ${flag}`,
      'a\u0301',
    ];
    for (const s of samples) expect(normalizeText(s)).toBe(s.normalize('NFC'));
  });

  it('treats shell/CI-looking text purely as data', () => {
    for (const s of ['$(rm -rf /)', '::error::file=x', 'a & b', 'C:\\\\path', '"quoted"']) {
      expect(normalizeText(s)).toBe(s);
    }
  });

  it('coerces null/undefined/non-strings to a string first', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(42)).toBe('42');
  });

  it('strips bidirectional embedding/override/isolate controls but keeps the visible text', () => {
    // U+202E RIGHT-TO-LEFT OVERRIDE would scramble everything rendered after it.
    expect(normalizeText('archivo \u202Egpj.exe')).toBe('archivo gpj.exe');
    expect(normalizeText('\u2066a\u2069 \u202Ab\u202C')).toBe('a b');
    // ZWJ (also Cf) is NOT stripped - the family stays whole.
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
    expect(normalizeText(family)).toBe(family);
  });
});

// -------------------------------------------------------------------------
// truncate
// -------------------------------------------------------------------------

describe('truncate', () => {
  it('returns the input untouched with no ellipsis when it already fits', () => {
    const r = truncate('titular corto', { fits: () => true });
    expect(r).toEqual({ text: 'titular corto', truncated: false });
  });

  it('reserves the ellipsis inside the budget and trims whitespace before it', () => {
    // longest prefix p where trimEnd(p) + '…' has length <= 6
    const r = truncate('hello world', { fits: (c) => c.length <= 6 });
    expect(r).toEqual({ text: 'hello…', truncated: true });
  });

  it('never splits a grapheme cluster', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
    const r = truncate(`ab${family}cd`, { fits: (c) => graphemeCount(c) <= 3 });
    // 'a','b' + ellipsis == 3 graphemes; adding the family would be 4 -> excluded whole
    expect(r).toEqual({ text: 'ab…', truncated: true });
    expect(r.text).not.toContain('\u200D');
  });

  it('honours a custom ellipsis', () => {
    const r = truncate('abcdef', { fits: (c) => c.length <= 4, ellipsis: '...' });
    expect(r).toEqual({ text: 'a...', truncated: true });
  });

  it('reports an empty result when not even the ellipsis fits', () => {
    expect(truncate('abc', { fits: () => false })).toEqual({ text: '', truncated: true });
  });

  it('throws for a non-function fits', () => {
    // @ts-expect-error deliberate misuse
    expect(() => truncate('x', {})).toThrow(TypeError);
  });
});

// -------------------------------------------------------------------------
// makeSocialPost — templates
// -------------------------------------------------------------------------

describe('makeSocialPost templates', () => {
  it('facebook and linkedin: title + description + canonical separated by blank lines', () => {
    for (const platform of ['facebook', 'linkedin'] as const) {
      const post = makeSocialPost(baseArticle(), { platform, account_key: 'acct' });
      expect(post.text).toBe(
        `Los físicos miden el eclipse solar\n\nUn estudio internacional describe la duración total del fenómeno.\n\n${CANONICAL}`
      );
      expect(post.link_card).toEqual({ uri: CANONICAL });
      expect(post.canonical_url).toBe(CANONICAL);
      expect(post.generator_version).toBe(GENERATOR_VERSION);
    }
  });

  it('facebook/linkedin without a description: title + canonical, no empty block', () => {
    for (const platform of ['facebook', 'linkedin'] as const) {
      const post = makeSocialPost(baseArticle({ description: undefined }), {
        platform,
        account_key: 'acct',
      });
      expect(post.text).toBe(`Los físicos miden el eclipse solar\n\n${CANONICAL}`);
      expect(post.text).not.toContain('\n\n\n');
    }
  });

  it('an empty / whitespace-only description is treated as absent', () => {
    const post = makeSocialPost(baseArticle({ description: '   \n\t ' }), {
      platform: 'facebook',
      account_key: 'acct',
    });
    expect(post.text).toBe(`Los físicos miden el eclipse solar\n\n${CANONICAL}`);
  });

  it('x: title + canonical only, never a description, no link card', () => {
    const post = makeSocialPost(baseArticle(), { platform: 'x', account_key: 'acct' });
    expect(post.text).toBe(`Los físicos miden el eclipse solar\n\n${CANONICAL}`);
    expect(post.text).not.toContain('Un estudio internacional');
    expect(post.link_card).toBeNull();
  });

  it('bluesky: title + linked label, canonical only in the card/facet', () => {
    const post = makeSocialPost(baseArticle(), { platform: 'bluesky', account_key: 'did:plc:x' });
    expect(post.text).toBe('Los físicos miden el eclipse solar\n\nnoticiencias.com');
    expect(post.text).not.toContain(CANONICAL);
    expect(post.link_card).toMatchObject({
      uri: CANONICAL,
      title: 'Los físicos miden el eclipse solar',
      description: 'Un estudio internacional describe la duración total del fenómeno.',
      label: 'noticiencias.com',
      thumb_url: null,
    });
  });

  it('bluesky: passes through a thumbnail URL for the adapter to size-check', () => {
    const post = makeSocialPost(
      baseArticle({ image_url: 'https://noticiencias.com/_astro/x.jpg' }),
      { platform: 'bluesky', account_key: 'did:plc:x' }
    );
    expect(post.link_card?.thumb_url).toBe('https://noticiencias.com/_astro/x.jpg');
  });

  it('bluesky: an absent description becomes an empty card description, not undefined', () => {
    const post = makeSocialPost(baseArticle({ description: undefined }), {
      platform: 'bluesky',
      account_key: 'did:plc:x',
    });
    expect(post.link_card?.description).toBe('');
  });
});

// -------------------------------------------------------------------------
// budgets: at the limit and above
// -------------------------------------------------------------------------

describe('makeSocialPost budgets', () => {
  it('facebook: a 200-unit title is kept whole; a 201-unit title is cut to <= 200', () => {
    const at = makeSocialPost(baseArticle({ title: 'a'.repeat(200), description: undefined }), {
      platform: 'facebook',
      account_key: 'acct',
    });
    expect(at.text.split('\n\n')[0]).toBe('a'.repeat(200));

    const over = makeSocialPost(baseArticle({ title: 'a'.repeat(201), description: undefined }), {
      platform: 'facebook',
      account_key: 'acct',
    });
    const title = over.text.split('\n\n')[0];
    expect(title.length).toBe(200);
    expect(title.endsWith('…')).toBe(true);
  });

  it('facebook: an over-long description is cut to <= 400 units with an ellipsis', () => {
    const post = makeSocialPost(baseArticle({ title: 'Corto', description: 'd'.repeat(500) }), {
      platform: 'facebook',
      account_key: 'acct',
    });
    const desc = post.text.split('\n\n')[1];
    expect(desc.length).toBe(400);
    expect(desc.endsWith('…')).toBe(true);
  });

  it('linkedin: the conservative 3000-unit total is enforced across all fields', () => {
    const post = makeSocialPost(baseArticle({ title: 'Título', description: 'd'.repeat(400) }), {
      platform: 'linkedin',
      account_key: 'acct',
    });
    expect(post.text.length).toBeLessThanOrEqual(3000);
  });

  it('linkedin: an over-tight total drops the description rather than raising an error', () => {
    // title(30) + block(2) + canonical(2968) == 3000 exactly, so not one
    // description grapheme (plus its block) can fit under the 3000 ceiling.
    const longCanonical = `https://noticiencias.com/${'x'.repeat(2942)}/`;
    expect(longCanonical.length).toBe(2968);

    // With the normal canonical the description does fit:
    const normal = makeSocialPost(
      baseArticle({ title: 'a'.repeat(30), description: 'contexto adicional' }),
      { platform: 'linkedin', account_key: 'acct' }
    );
    expect(normal.text).toContain('contexto adicional');

    const tight = makeSocialPost(
      baseArticle({
        title: 'a'.repeat(30),
        description: 'contexto adicional',
        canonical_url: longCanonical,
      }),
      { platform: 'linkedin', account_key: 'acct' }
    );
    expect(tight.text).toBe(`${'a'.repeat(30)}\n\n${longCanonical}`);
    expect(tight.text).not.toContain('contexto');
    expect(tight.text.length).toBe(3000);
  });

  it('x: a 126-codepoint title fits whole; 127 is cut just past the boundary', () => {
    const weight = (text: string): number => {
      const [nonUrl] = text.split('\n\n');
      return 2 * codePoints(`${nonUrl}\n\n`) + 23;
    };
    const at = makeSocialPost(baseArticle({ title: 'á'.repeat(126), description: undefined }), {
      platform: 'x',
      account_key: 'acct',
    });
    expect(at.text.split('\n\n')[0]).toBe('á'.repeat(126)); // untouched
    expect(at.text.split('\n\n')[0].endsWith('…')).toBe(false);
    expect(weight(at.text)).toBe(279);

    const over = makeSocialPost(baseArticle({ title: 'á'.repeat(127), description: undefined }), {
      platform: 'x',
      account_key: 'acct',
    });
    const kept = over.text.split('\n\n')[0];
    expect(kept.endsWith('…')).toBe(true);
    expect(kept).not.toBe('á'.repeat(127));
    expect(weight(over.text)).toBeLessThanOrEqual(280);
  });

  it('x: a URL sitting inside the title is over-counted as text, never as 23', () => {
    // 130 code points of title, all plain text, including a URL-looking run.
    const title = `Mira http://ejemplo.test/x ${'z'.repeat(103)}`;
    expect(codePoints(title)).toBe(130);
    const post = makeSocialPost(baseArticle({ title, description: undefined }), {
      platform: 'x',
      account_key: 'acct',
    });
    const kept = post.text.split('\n\n')[0];
    // 130 cp would weigh 2*(130+2)+23 = 287 > 280, so it must have been cut.
    expect(kept.endsWith('…')).toBe(true);
    expect(2 * codePoints(`${kept}\n\n`) + 23).toBeLessThanOrEqual(280);
  });

  it('keeps a long canonical intact and unshortened on every network', () => {
    const longCanonical = `https://noticiencias.com/ciencia/${'seg-'.repeat(40)}final/`;
    for (const platform of PLATFORMS) {
      const post = makeSocialPost(baseArticle({ canonical_url: longCanonical }), {
        platform,
        account_key: 'acct',
      });
      expect(post.canonical_url).toBe(longCanonical);
      if (platform === 'bluesky') expect(post.link_card?.uri).toBe(longCanonical);
      else expect(post.text.endsWith(longCanonical)).toBe(true);
    }
  });
});

// -------------------------------------------------------------------------
// bluesky simultaneous grapheme + byte limits
// -------------------------------------------------------------------------

describe('makeSocialPost bluesky grapheme/byte limits', () => {
  // suffix = "\n\n" + "noticiencias.com" = 18 graphemes / 18 bytes.
  it('grapheme limit: a 300-grapheme total is kept whole, 301 is cut', () => {
    const at = makeSocialPost(baseArticle({ title: 'é'.repeat(282), description: undefined }), {
      platform: 'bluesky',
      account_key: 'did:plc:x',
    });
    expect(graphemeCount(at.text)).toBe(300);
    expect(at.text.split('\n\n')[0]).toBe('é'.repeat(282)); // untouched

    const over = makeSocialPost(baseArticle({ title: 'é'.repeat(283), description: undefined }), {
      platform: 'bluesky',
      account_key: 'did:plc:x',
    });
    expect(graphemeCount(over.text)).toBeLessThanOrEqual(300);
    expect(utf8(over.text)).toBeLessThanOrEqual(3000);
    expect(over.text.endsWith('…\n\nnoticiencias.com')).toBe(true);
  });

  it('byte limit: binds before the grapheme limit for many-byte clusters', () => {
    // A 4-person ZWJ family is 1 grapheme but 25 UTF-8 bytes. 119 + 18-byte
    // suffix = 2993 bytes (fits); 120 = 3018 (does not), at 138 graphemes.
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
    expect(utf8(family)).toBe(25);

    const at = makeSocialPost(baseArticle({ title: family.repeat(119), description: undefined }), {
      platform: 'bluesky',
      account_key: 'did:plc:x',
    });
    expect(utf8(at.text)).toBe(2993);
    expect(at.text.split('\n\n')[0]).toBe(family.repeat(119)); // untouched

    const over = makeSocialPost(
      baseArticle({ title: family.repeat(120), description: undefined }),
      {
        platform: 'bluesky',
        account_key: 'did:plc:x',
      }
    );
    expect(utf8(over.text)).toBeLessThanOrEqual(3000);
    // bytes were the active limit — the result is nowhere near 300 graphemes
    expect(graphemeCount(over.text)).toBeLessThan(150);
    expect(over.text.endsWith('…\n\nnoticiencias.com')).toBe(true);
  });

  it('byte limit: the comparison is <= — exactly 3000 bytes is kept, 3001 is cut', () => {
    // Two-person ZWJ pair: 1 grapheme, 11 UTF-8 bytes. 271 pairs + one ASCII
    // char = 2982 title bytes; + 18-byte suffix = 3000 bytes at 290 graphemes,
    // so the grapheme ceiling stays slack and bytes are provably the binding
    // limit at the boundary. §20.9 names the 3000/3001 byte edge explicitly.
    const pair = '\u{1F468}\u200D\u{1F469}';
    expect(utf8(pair)).toBe(11);
    expect(graphemeCount(pair)).toBe(1);

    const at = makeSocialPost(
      baseArticle({ title: `${pair.repeat(271)}a`, description: undefined }),
      { platform: 'bluesky', account_key: 'did:plc:x' }
    );
    expect(utf8(at.text)).toBe(3000);
    expect(graphemeCount(at.text)).toBe(290);
    expect(at.text.split('\n\n')[0]).toBe(`${pair.repeat(271)}a`); // untouched

    const over = makeSocialPost(
      baseArticle({ title: `${pair.repeat(271)}aa`, description: undefined }),
      { platform: 'bluesky', account_key: 'did:plc:x' }
    );
    expect(utf8(over.text)).toBeLessThanOrEqual(3000);
    expect(over.text.split('\n\n')[0].endsWith('…')).toBe(true); // it was cut
  });
});

// -------------------------------------------------------------------------
// bluesky external card
// -------------------------------------------------------------------------

describe('makeSocialPost bluesky card', () => {
  it('clamps the card title to 200 graphemes / description to 400, independent of post text', () => {
    // 250-grapheme title fits the 300-grapheme post limit untouched, yet the
    // card still clamps its own copy to 200 — the two limits are separate.
    const post = makeSocialPost(
      baseArticle({ title: 'z'.repeat(250), description: 'd'.repeat(500) }),
      { platform: 'bluesky', account_key: 'did:plc:x' }
    );
    const card = post.link_card!;
    expect(graphemeCount(post.text.split('\n\n')[0])).toBe(250); // post text: untouched
    expect(graphemeCount(card.title!)).toBe(200); // card: clamped
    expect(card.title).toBe(`${'z'.repeat(199)}…`);
    expect(graphemeCount(card.description!)).toBe(400);
    expect(card.description).toBe(`${'d'.repeat(399)}…`);
  });

  it('keeps a short title/description in the card verbatim', () => {
    const post = makeSocialPost(baseArticle(), { platform: 'bluesky', account_key: 'did:plc:x' });
    expect(post.link_card!.title).toBe('Los físicos miden el eclipse solar');
    expect(post.link_card!.description).toBe(
      'Un estudio internacional describe la duración total del fenómeno.'
    );
  });
});

// -------------------------------------------------------------------------
// bluesky facet byte offsets
// -------------------------------------------------------------------------

describe('makeSocialPost bluesky facet offsets', () => {
  it('label_byte_start/end slice exactly "noticiencias.com" out of the UTF-8 text', () => {
    for (const title of [
      'Título con tildes é í ó',
      'Con emoji \u{1F30D} al medio',
      'Marca combinante a\u0301 aislada',
      'a'.repeat(180),
    ]) {
      const post = makeSocialPost(baseArticle({ title }), {
        platform: 'bluesky',
        account_key: 'did:plc:x',
      });
      const card = post.link_card!;
      const bytes = Buffer.from(post.text, 'utf8');
      expect(bytes.subarray(card.label_byte_start, card.label_byte_end).toString('utf8')).toBe(
        'noticiencias.com'
      );
    }
  });

  it('offsets track the post-truncation title, not the original', () => {
    for (const title of ['é'.repeat(400), '\u{1F30D}'.repeat(320)]) {
      const post = makeSocialPost(baseArticle({ title }), {
        platform: 'bluesky',
        account_key: 'did:plc:x',
      });
      const card = post.link_card!;
      const bytes = Buffer.from(post.text, 'utf8');
      expect(post.text.split('\n\n')[0].endsWith('…')).toBe(true); // it was cut
      expect(bytes.subarray(card.label_byte_start, card.label_byte_end).toString('utf8')).toBe(
        'noticiencias.com'
      );
      expect(card.label_byte_end).toBe(bytes.length);
    }
  });

  it('point at the trailing label even when the title itself contains "noticiencias.com"', () => {
    // The offsets are computed arithmetically from the prefix length; a rewrite
    // to text.indexOf('noticiencias.com') would land on the first occurrence
    // inside the title and pass every other test in this file.
    const post = makeSocialPost(
      baseArticle({ title: 'noticiencias.com publica un estudio sobre el eclipse' }),
      { platform: 'bluesky', account_key: 'did:plc:x' }
    );
    const card = post.link_card!;
    const bytes = Buffer.from(post.text, 'utf8');
    // the linked span is the final "noticiencias.com", not the one at byte 0
    expect(card.label_byte_start).toBe(bytes.length - utf8('noticiencias.com'));
    expect(card.label_byte_end).toBe(bytes.length);
    expect(bytes.subarray(card.label_byte_start, card.label_byte_end).toString('utf8')).toBe(
      'noticiencias.com'
    );
    expect(post.text.indexOf('noticiencias.com')).toBe(0); // the decoy is really there
  });
});

// -------------------------------------------------------------------------
// validation
// -------------------------------------------------------------------------

describe('makeSocialPost validation', () => {
  it('rejects a non-object article or destination', () => {
    // @ts-expect-error deliberate
    expect(() => makeSocialPost(null, { platform: 'x', account_key: 'a' })).toThrow(
      SocialContentError
    );
    // @ts-expect-error deliberate
    expect(() => makeSocialPost(baseArticle(), null)).toThrow(SocialContentError);
  });

  it('rejects an unknown platform', () => {
    expect(() =>
      makeSocialPost(baseArticle(), { platform: 'mastodon', account_key: 'a' })
    ).toThrowError(expect.objectContaining({ code: 'INVALID_PLATFORM' }));
  });

  it('rejects a missing or blank account_key', () => {
    for (const account_key of ['', '   ', undefined as unknown as string]) {
      expect(() => makeSocialPost(baseArticle(), { platform: 'x', account_key })).toThrowError(
        expect.objectContaining({ code: 'INVALID_DESTINATION' })
      );
    }
  });

  it('rejects a canonical that is not a bare https noticiencias.com URL', () => {
    for (const canonical_url of [
      'http://noticiencias.com/x/',
      'https://evil.example/x/',
      'https://user:pass@noticiencias.com/x/',
      'https://noticiencias.com/x/?utm=1',
      'https://noticiencias.com/x/#frag',
      'not a url',
    ]) {
      expect(() =>
        makeSocialPost(baseArticle({ canonical_url }), { platform: 'facebook', account_key: 'a' })
      ).toThrowError(expect.objectContaining({ code: 'INVALID_CANONICAL' }));
    }
  });

  it('rejects a non-ASCII canonical for X only', () => {
    const canonical_url = 'https://noticiencias.com/ciencia/eclipsé/';
    expect(() =>
      makeSocialPost(baseArticle({ canonical_url }), { platform: 'x', account_key: 'a' })
    ).toThrowError(expect.objectContaining({ code: 'INVALID_CANONICAL' }));
    // other networks count the URL literally and accept it
    expect(() =>
      makeSocialPost(baseArticle({ canonical_url }), { platform: 'facebook', account_key: 'a' })
    ).not.toThrow();
  });

  it('rejects a title that is empty after normalization', () => {
    for (const title of ['', '   ', '\u0000\u0001', '\n\t']) {
      expect(() =>
        makeSocialPost(baseArticle({ title }), { platform: 'x', account_key: 'a' })
      ).toThrowError(expect.objectContaining({ code: 'INVALID_TEXT' }));
    }
  });

  it('treats quotes, ampersands, backslashes and $()/::error:: in copy as data', () => {
    const title = 'El "gran" hallazgo & la duda \\ $(whoami) ::error::x';
    const post = makeSocialPost(baseArticle({ title, description: undefined }), {
      platform: 'facebook',
      account_key: 'acct',
    });
    expect(post.text.split('\n\n')[0]).toBe(title);
  });
});

// -------------------------------------------------------------------------
// platform list stays in sync with article.js
// -------------------------------------------------------------------------

describe('PLATFORMS', () => {
  it('matches PLATFORM_ORDER exported by article.js', () => {
    expect([...PLATFORMS]).toEqual([...PLATFORM_ORDER]);
  });
});

// -------------------------------------------------------------------------
// payload_hash
// -------------------------------------------------------------------------

describe('payload_hash', () => {
  it('equals SHA-256 of the documented preimage (prefix + canonical JSON)', () => {
    const post = makeSocialPost(baseArticle({ title: 'Hola mundo', description: undefined }), {
      platform: 'x',
      account_key: 'x-acct',
    });
    expect(post.text).toBe(`Hola mundo\n\n${CANONICAL}`);

    // Hand-written preimage: domain prefix (ending in a real newline) followed
    // by the canonical JSON serialization with keys in lexicographic order and
    // standard JSON string escaping (so the two block newlines appear as \n).
    const json =
      '{' +
      '"account_key":"x-acct",' +
      `"canonical_url":"${CANONICAL}",` +
      '"generator_version":1,' +
      '"link_card":null,' +
      '"platform":"x",' +
      '"text":"Hola mundo\\n\\n' +
      CANONICAL +
      '"' +
      '}';
    const preimage = 'noticiencias.com/social/post/v1\n' + json;
    const expected = createHash('sha256').update(Buffer.from(preimage, 'utf8')).digest('hex');

    expect(post.payload_hash).toBe(expected);
    expect(post.payload_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable: identical inputs produce an identical hash', () => {
    const mk = () =>
      makeSocialPost(baseArticle(), { platform: 'bluesky', account_key: 'did:plc:x' }).payload_hash;
    expect(mk()).toBe(mk());
  });

  it('changes when the destination changes', () => {
    const a = makeSocialPost(baseArticle(), { platform: 'x', account_key: 'acct-1' });
    const b = makeSocialPost(baseArticle(), { platform: 'x', account_key: 'acct-2' });
    const c = makeSocialPost(baseArticle(), { platform: 'facebook', account_key: 'acct-1' });
    expect(a.payload_hash).not.toBe(b.payload_hash);
    expect(a.payload_hash).not.toBe(c.payload_hash);
  });

  it('changes when rendered content changes (title, description, canonical)', () => {
    const base = makeSocialPost(baseArticle(), {
      platform: 'facebook',
      account_key: 'acct',
    }).payload_hash;
    const otherTitle = makeSocialPost(baseArticle({ title: 'Otro titular' }), {
      platform: 'facebook',
      account_key: 'acct',
    }).payload_hash;
    const otherDesc = makeSocialPost(baseArticle({ description: 'Otra descripción distinta.' }), {
      platform: 'facebook',
      account_key: 'acct',
    }).payload_hash;
    const otherCanonical = makeSocialPost(
      baseArticle({ canonical_url: 'https://noticiencias.com/ciencia/otro/' }),
      { platform: 'facebook', account_key: 'acct' }
    ).payload_hash;
    expect(new Set([base, otherTitle, otherDesc, otherCanonical]).size).toBe(4);
  });

  it('is unaffected by an editorial identity field that is not rendered', () => {
    const a = makeSocialPost(baseArticle({ social_id: 'a'.repeat(64) }), {
      platform: 'x',
      account_key: 'acct',
    });
    const b = makeSocialPost(baseArticle({ social_id: 'b'.repeat(64), collection_id: 'x' }), {
      platform: 'x',
      account_key: 'acct',
    });
    expect(a.payload_hash).toBe(b.payload_hash);
  });

  it('folds NFC/NFD title variants to the same hash', () => {
    const composed = makeSocialPost(baseArticle({ title: 'caf\u00e9' }), {
      platform: 'x',
      account_key: 'acct',
    });
    const decomposed = makeSocialPost(baseArticle({ title: 'cafe\u0301' }), {
      platform: 'x',
      account_key: 'acct',
    });
    expect(composed.payload_hash).toBe(decomposed.payload_hash);
  });
});
