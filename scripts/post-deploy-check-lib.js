import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { load } from 'cheerio';

const execFileAsync = promisify(execFile);

/**
 * @typedef {{
 *   ok: boolean;
 *   status: number | null;
 *   body: string;
 *   headers: Record<string, string>;
 *   transport: 'fetch' | 'curl';
 *   url: string;
 *   error: Error | null;
 * }} ProbeResult
 */

/**
 * @typedef {{
 *   info: (message: string) => void;
 *   warn: (message: string) => void;
 *   error: (message: string) => void;
 * }} DeployCheckLogger
 */

/**
 * @typedef {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} FetchLike
 */

/**
 * @typedef {(url: string, options?: { timeoutMs?: number; userAgent?: string }) => Promise<ProbeResult>} CurlRunner
 */

/**
 * @typedef {{
 *   mode?: string;
 *   fetchImpl?: FetchLike;
 *   curlRunner?: CurlRunner;
 *   retryDelaysMs?: number[];
 *   sleep?: (ms: number) => Promise<void>;
 *   logger?: DeployCheckLogger;
 *   timeoutMs?: number;
 *   userAgent?: string;
 * }} DeployCheckOptions
 */

export const DEFAULT_TARGET_URL = 'http://localhost:4321';
export const DEFAULT_DEPLOY_CHECK_MODE = 'strict-live';
export const DEFAULT_USER_AGENT = 'Noticiencias-DeployCheck/2.0 (Mozilla/5.0; GitHub Actions)';
export const DEFAULT_RETRY_DELAYS_MS = [0, 3000, 7000, 15000, 35000];

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 500, 502, 503, 504, 521, 522, 523, 524]);
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function normalizeMode(mode) {
  return mode === 'hybrid' ? 'hybrid' : 'strict-live';
}

function headersToObject(headers = {}) {
  if (!headers) return {};

  if (typeof headers.forEach === 'function') {
    const object = {};
    headers.forEach((value, key) => {
      object[String(key).toLowerCase()] = value;
    });
    return object;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)])
  );
}

function getHostname(url) {
  return new URL(url).hostname;
}

function isCustomDomain(url) {
  return !getHostname(url).endsWith('.github.io');
}

function formatStatus(status) {
  return status == null ? 'network error' : `HTTP ${status}`;
}

function formatHeadersForLog(headers = {}) {
  const server = headers.server ? `server=${headers.server}` : null;
  const cfRay = headers['cf-ray'] ? `cf-ray=${headers['cf-ray']}` : null;
  return [server, cfRay].filter(Boolean).join(', ');
}

function hasEdgeMarkers(url, headers = {}, body = '') {
  if (!isCustomDomain(url)) return false;

  const lowerBody = body.toLowerCase();
  const server = String(headers.server || '').toLowerCase();

  return (
    server.includes('cloudflare') ||
    Boolean(headers['cf-ray']) ||
    Boolean(headers['cf-cache-status']) ||
    lowerBody.includes('attention required') ||
    lowerBody.includes('cloudflare')
  );
}

export function classifyHttpResult({ url, status, headers = {}, body = '', error = null }) {
  if (error) {
    return 'transient';
  }

  if (status >= 200 && status < 300) {
    return 'ok';
  }

  if ((status === 403 || status === 429) && hasEdgeMarkers(url, headers, body)) {
    return 'edge-blocked';
  }

  if (RETRYABLE_HTTP_STATUSES.has(status)) {
    return 'transient';
  }

  return 'hard-fail';
}

/** @returns {DeployCheckLogger} */
function createLogger() {
  return {
    info(message) {
      console.log(message);
    },
    warn(message) {
      console.warn(message);
    },
    error(message) {
      console.error(message);
    },
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildFetchHeaders(userAgent) {
  return {
    'User-Agent': userAgent,
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
}

function buildFailureSummary(result) {
  const details = formatHeadersForLog(result.headers);
  const suffix = details ? ` (${details})` : '';

  if (result.error) {
    return `${result.transport} ${result.error.name || 'Error'}: ${result.error.message}`;
  }

  return `${result.transport} ${formatStatus(result.status)}${suffix}`;
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: FetchLike; timeoutMs?: number; userAgent?: string }} [options]
 * @returns {Promise<ProbeResult>}
 */
async function fetchText(url, { fetchImpl = fetch, timeoutMs = 15000, userAgent = DEFAULT_USER_AGENT } = {}) {
  try {
    const response = await fetchImpl(url, {
      headers: buildFetchHeaders(userAgent),
      redirect: 'follow',
      signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
      headers: headersToObject(response.headers),
      transport: 'fetch',
      url,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: '',
      headers: {},
      transport: 'fetch',
      url,
      error,
    };
  }
}

function parseCurlMarker(output, marker) {
  const markerPrefix = `\n${marker}:`;
  const index = output.lastIndexOf(markerPrefix);

  if (index === -1) {
    return null;
  }

  const valueStart = index + markerPrefix.length;
  const nextNewline = output.indexOf('\n', valueStart);
  const valueEnd = nextNewline === -1 ? output.length : nextNewline;

  return {
    value: output.slice(valueStart, valueEnd),
    index,
  };
}

function parseCurlBlockMarker(output, marker, endMarker) {
  const markerPrefix = `\n${marker}:`;
  const startIndex = output.lastIndexOf(markerPrefix);

  if (startIndex === -1) {
    return null;
  }

  const valueStart = startIndex + markerPrefix.length;
  const endIndex = output.indexOf(`\n${endMarker}:`, valueStart);
  const valueEnd = endIndex === -1 ? output.length : endIndex;

  return {
    value: output.slice(valueStart, valueEnd),
    index: startIndex,
  };
}

/**
 * @param {string} output
 * @param {{ statusMarker: string; headerMarker: string; endMarker: string }} markers
 */
export function parseCurlMetadata(output, { statusMarker, headerMarker, endMarker }) {
  const status = parseCurlMarker(output, statusMarker);
  const headers = parseCurlBlockMarker(output, headerMarker, endMarker);

  if (!status || !headers) {
    throw new Error('curl output missing status markers');
  }

  return {
    status: Number(status.value),
    headers: headers.value ? JSON.parse(headers.value) : {},
    body: output.slice(0, status.index),
  };
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number; userAgent?: string }} [options]
 * @returns {Promise<ProbeResult>}
 */
async function defaultCurlRunner(url, { timeoutMs = 15000, userAgent = DEFAULT_USER_AGENT } = {}) {
  const markerStatus = '__NOTICIENCIAS_CURL_STATUS__';
  const markerHeaders = '__NOTICIENCIAS_CURL_HEADERS__';
  const markerEnd = '__NOTICIENCIAS_CURL_END__';

  try {
    const { stdout } = await execFileAsync(
      'curl',
      [
        '--silent',
        '--show-error',
        '--location',
        '--max-time',
        String(Math.max(5, Math.ceil(timeoutMs / 1000))),
        '-A',
        userAgent,
        '-H',
        'Accept: text/html,application/json;q=0.9,*/*;q=0.8',
        '-H',
        'Cache-Control: no-cache',
        '-H',
        'Pragma: no-cache',
        '--write-out',
        `\n${markerStatus}:%{http_code}\n${markerHeaders}:%{header_json}\n${markerEnd}:1\n`,
        url,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const metadata = parseCurlMetadata(stdout, {
      statusMarker: markerStatus,
      headerMarker: markerHeaders,
      endMarker: markerEnd,
    });

    return {
      ok: metadata.status >= 200 && metadata.status < 300,
      status: metadata.status,
      body: metadata.body,
      headers: headersToObject(metadata.headers),
      transport: 'curl',
      url,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: '',
      headers: {},
      transport: 'curl',
      url,
      error,
    };
  }
}

/**
 * @param {string} url
 * @param {{ curlRunner?: CurlRunner; timeoutMs?: number; userAgent?: string }} [options]
 * @returns {Promise<ProbeResult>}
 */
async function runCurlFallback(url, options) {
  const curlRunner = options.curlRunner || defaultCurlRunner;
  return curlRunner(url, options);
}

/**
 * @param {string} url
 * @param {DeployCheckOptions} [options]
 */
export async function probeUrl(
  url,
  {
    mode = DEFAULT_DEPLOY_CHECK_MODE,
    fetchImpl = fetch,
    curlRunner,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
    logger = createLogger(),
    timeoutMs = 15000,
    userAgent = DEFAULT_USER_AGENT,
  } = {}
) {
  const normalizedMode = normalizeMode(mode);
  let lastFailure = null;

  for (let attemptIndex = 0; attemptIndex < retryDelaysMs.length; attemptIndex += 1) {
    const delayMs = retryDelaysMs[attemptIndex];

    if (attemptIndex > 0 && delayMs > 0) {
      logger.info(`Retrying ${url} in ${Math.ceil(delayMs / 1000)}s (${attemptIndex + 1}/${retryDelaysMs.length})...`);
      await sleep(delayMs);
    }

    const fetchResult = await fetchText(url, { fetchImpl, timeoutMs, userAgent });
    const fetchClassification = classifyHttpResult(fetchResult);

    if (fetchClassification === 'ok') {
      logger.info(`${GREEN}[PASS] ${url} reachable via fetch (${formatStatus(fetchResult.status)})${RESET}`);
      return { outcome: 'success', result: fetchResult };
    }

    if (fetchClassification === 'edge-blocked') {
      logger.warn(
        `${YELLOW}[WARN] fetch hit edge access controls for ${url}: ${buildFailureSummary(fetchResult)}. Trying curl fallback...${RESET}`
      );

      const curlResult = await runCurlFallback(url, { curlRunner, timeoutMs, userAgent });
      const curlClassification = classifyHttpResult(curlResult);

      if (curlClassification === 'ok') {
        logger.info(`${GREEN}[PASS] ${url} reachable via curl fallback (${formatStatus(curlResult.status)})${RESET}`);
        return { outcome: 'success', result: curlResult };
      }

      lastFailure = {
        classification: curlClassification,
        result: curlResult,
        summary: buildFailureSummary(curlResult),
      };

      if (curlClassification === 'hard-fail') {
        throw new Error(`Failed to fetch ${url}: ${lastFailure.summary}`);
      }

      continue;
    }

    lastFailure = {
      classification: fetchClassification,
      result: fetchResult,
      summary: buildFailureSummary(fetchResult),
    };

    if (fetchClassification === 'hard-fail') {
      throw new Error(`Failed to fetch ${url}: ${lastFailure.summary}`);
    }
  }

  if (!lastFailure) {
    throw new Error(`Failed to fetch ${url}: no probe attempts were executed`);
  }

  if (lastFailure.classification === 'edge-blocked' && normalizedMode === 'hybrid') {
    const warning = `Edge access to ${url} remained blocked after retries (${lastFailure.summary}); continuing in hybrid mode.`;
    logger.warn(`${YELLOW}[WARN] ${warning}${RESET}`);
    return { outcome: 'warning', warning };
  }

  throw new Error(`Failed to fetch ${url}: ${lastFailure.summary}`);
}

/**
 * @param {string} html
 * @param {string} targetUrl
 */
export function verifyHomeHtml(html, targetUrl) {
  const $ = load(html);
  const title = $('title').text();

  if (!title.includes('Noticiencias')) {
    throw new Error(`Home title missing 'Noticiencias'. Got: "${title}"`);
  }

  const articles = $('article');
  if (articles.length < 3) {
    throw new Error(`Home page has fewer than 3 articles. Found: ${articles.length}`);
  }

  const firstArticleLink = articles.first().find('a[href]').attr('href');
  if (!firstArticleLink) {
    return {
      articleUrl: null,
      warnings: ['No article link found on the home page; skipping article detail verification.'],
      articleCount: articles.length,
    };
  }

  return {
    articleUrl: new URL(firstArticleLink, targetUrl).toString(),
    warnings: [],
    articleCount: articles.length,
  };
}

/**
 * @param {string} html
 */
export function verifyArticleHtml(html) {
  const $ = load(html);
  const title = $('title').text();
  const h1 = $('h1').text();
  const warnings = [];

  if (h1.includes('404') || title.includes('404')) {
    throw new Error('Article page appears to be a 404.');
  }

  if ($('img').length === 0) {
    warnings.push('Article has no images.');
  }

  return { warnings };
}

/**
 * @param {string} html
 */
export function verifyRouteHtml(html) {
  const $ = load(html);
  const title = $('title').text();

  if (!title.includes('Noticiencias')) {
    throw new Error(`Route title missing 'Noticiencias'. Got: "${title}"`);
  }

  if (html.includes('rocket-loader.min.js')) {
    throw new Error('HTML includes Cloudflare Rocket Loader. Disable Rocket Loader for Astro client-script routes.');
  }

  const rewrittenScriptTypes = $('script[type]')
    .map((_, el) => $(el).attr('type'))
    .get()
    .filter((type) => typeof type === 'string' && /^[a-f0-9]{20,}-(?:module|text\/javascript)$/.test(type));

  if (rewrittenScriptTypes.length > 0) {
    throw new Error('HTML includes Cloudflare-rewritten script types that can defer Astro client scripts.');
  }

  return {
    clientRouterScripts: $('script[src*="ClientRouter"]').length,
  };
}

/**
 * @param {unknown} json
 */
export function verifySearchJson(json) {
  if (!Array.isArray(json)) {
    throw new Error('Search index is not an array.');
  }

  if (json.length === 0) {
    throw new Error('Search index is empty.');
  }

  const firstItem = json[0];
  if (!firstItem || !firstItem.title || !firstItem.url) {
    throw new Error('Search item missing required fields (title, url).');
  }

  return { itemCount: json.length };
}

/**
 * @param {string} body
 */
export function verifyRssXml(body) {
  if (!body.includes('<rss') && !body.includes('<feed')) {
    throw new Error('RSS response is not valid XML feed content.');
  }

  if (!body.includes('Noticiencias')) {
    throw new Error('RSS feed is missing expected site branding.');
  }

  return { ok: true };
}

/**
 * @param {string} targetUrl
 * @param {DeployCheckOptions} [options]
 */
export async function runPostDeployCheck(
  targetUrl,
  {
    mode = DEFAULT_DEPLOY_CHECK_MODE,
    fetchImpl = fetch,
    curlRunner,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
    logger = createLogger(),
    timeoutMs = 15000,
    userAgent = DEFAULT_USER_AGENT,
  } = {}
) {
  const warnings = [];

  logger.info(`${YELLOW}Starting Post-Deploy Check against: ${targetUrl} (mode=${normalizeMode(mode)})${RESET}`);
  logger.info('Checking Home Page...');

  const homeProbe = await probeUrl(targetUrl, {
    mode,
    fetchImpl,
    curlRunner,
    retryDelaysMs,
    sleep,
    logger,
    timeoutMs,
    userAgent,
  });

  if (homeProbe.outcome === 'warning') {
    warnings.push(homeProbe.warning);
    return { success: true, warnings };
  }

  const homeResult = verifyHomeHtml(homeProbe.result.body, targetUrl);
  warnings.push(...homeResult.warnings);
  logger.info(`${GREEN}[PASS] Home Page OK (${homeResult.articleCount} articles)${RESET}`);

  const homeRouteResult = verifyRouteHtml(homeProbe.result.body);
  if (homeRouteResult.clientRouterScripts > 0) {
    logger.info(`${GREEN}[PASS] Home Route HTML OK (${homeRouteResult.clientRouterScripts} ClientRouter script)${RESET}`);
  }

  if (homeResult.articleUrl) {
    logger.info(`Checking Article: ${homeResult.articleUrl}...`);

    const articleProbe = await probeUrl(homeResult.articleUrl, {
      mode,
      fetchImpl,
      curlRunner,
      retryDelaysMs,
      sleep,
      logger,
      timeoutMs,
      userAgent,
    });

    if (articleProbe.outcome === 'warning') {
      warnings.push(articleProbe.warning);
    } else {
      const articleResult = verifyArticleHtml(articleProbe.result.body);
      warnings.push(...articleResult.warnings);
      logger.info(`${GREEN}[PASS] Article Page OK${RESET}`);
    }
  }

  const searchPageUrl = new URL('/buscar/', targetUrl).toString();
  logger.info(`Checking Search Page: ${searchPageUrl}...`);

  const searchPageProbe = await probeUrl(searchPageUrl, {
    mode,
    fetchImpl,
    curlRunner,
    retryDelaysMs,
    sleep,
    logger,
    timeoutMs,
    userAgent,
  });

  if (searchPageProbe.outcome === 'warning') {
    warnings.push(searchPageProbe.warning);
  } else {
    verifyRouteHtml(searchPageProbe.result.body);
    logger.info(`${GREEN}[PASS] Search Page OK${RESET}`);
  }

  const searchUrl = new URL('/search.json', targetUrl).toString();
  logger.info(`Checking Search Index: ${searchUrl}...`);

  const searchProbe = await probeUrl(searchUrl, {
    mode,
    fetchImpl,
    curlRunner,
    retryDelaysMs,
    sleep,
    logger,
    timeoutMs,
    userAgent,
  });

  if (searchProbe.outcome === 'warning') {
    warnings.push(searchProbe.warning);
  } else {
    let json;

    try {
      json = JSON.parse(searchProbe.result.body);
    } catch (error) {
      throw new Error(`Search Index verification failed: invalid JSON (${error.message})`);
    }

    const searchResult = verifySearchJson(json);
    logger.info(`${GREEN}[PASS] Search Index OK (${searchResult.itemCount} items)${RESET}`);
  }

  const rssUrl = new URL('/rss.xml', targetUrl).toString();
  logger.info(`Checking RSS Feed: ${rssUrl}...`);

  const rssProbe = await probeUrl(rssUrl, {
    mode,
    fetchImpl,
    curlRunner,
    retryDelaysMs,
    sleep,
    logger,
    timeoutMs,
    userAgent,
  });

  if (rssProbe.outcome === 'warning') {
    warnings.push(rssProbe.warning);
  } else {
    verifyRssXml(rssProbe.result.body);
    logger.info(`${GREEN}[PASS] RSS Feed OK${RESET}`);
  }

  return { success: true, warnings };
}

export function formatFinalSummary(warnings = []) {
  if (warnings.length === 0) {
    return `\n${GREEN}All Post-Deploy Checks PASSED!${RESET}`;
  }

  return `\n${YELLOW}Post-Deploy Check completed with ${warnings.length} warning(s).${RESET}`;
}
