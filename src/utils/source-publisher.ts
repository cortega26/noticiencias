import type { Post } from '~/types';

/**
 * Mapa de publicadores legibles por hostname de `source_url`.
 * Cobertura derivada de los `source_url` reales en `src/content/posts/`
 * (verificado 2026-08-02). Los hostnames fuera del mapa caen al hostname
 * desnudo como publicador, nunca a un valor inventado.
 *
 * El publicador es un dato derivado en frontend (ADR-0003: front-end-owned
 * computed field); no se agrega al schema sellado de contenido.
 */
export const hostnameToPublisher: Record<string, string> = {
  '404media.co': '404 Media',
  'arstechnica.com': 'Ars Technica',
  'livescience.com': 'Live Science',
  'microsoft.com': 'Microsoft Research',
  'nasa.gov': 'NASA',
  'news.mit.edu': 'MIT News',
  'newscientist.com': 'New Scientist',
  'noticiencias.com': 'Noticiencias',
  'quantamagazine.org': 'Quanta Magazine',
  'sciencedaily.com': 'ScienceDaily',
  'scientificamerican.com': 'Scientific American',
  'scitechdaily.com': 'SciTechDaily',
  'security.googleblog.com': 'Google Security Blog',
  'techcrunch.com': 'TechCrunch',
  'technologyreview.com': 'MIT Technology Review',
  'theconversation.com': 'The Conversation',
  'wlab.yale.edu': 'Yale Wright Laboratory',
};

/**
 * Resuelve el publicador de un post derivando el hostname de `source_url`.
 * Devuelve `null` cuando el post no declara una fuente primaria.
 */
export function resolveSourcePublisher(post: Pick<Post, 'source_url'>): string | null {
  if (!post.source_url) return null;

  let hostname: string;
  try {
    hostname = new URL(post.source_url).hostname.replace(/^www\./, '');
  } catch {
    // Null contract: a malformed URL means "no resolvable publisher" —
    // silence by design (callers fall back to the bare hostname/generic).
    return null;
  }

  return hostnameToPublisher[hostname] ?? hostname;
}

export interface SourceAttribution {
  /** Publicadores de las fuentes declaradas `role: primary`, sin duplicados y en orden. */
  primary: string[];
  /** Publicador de la nota secundaria (o del `source_url` heredado) en que se apoya la pieza. */
  coverage: string | null;
}

type AttributableSource = { url: string; publisher?: string; role?: 'primary' | 'secondary' };

function publisherOf(source: AttributableSource): string | null {
  const declared = source.publisher?.trim();
  return declared || resolveSourcePublisher({ source_url: source.url });
}

/**
 * Atribución exacta de fuentes para la línea «Fuente»: separa las fuentes
 * primarias (estudios, comunicados) de la cobertura secundaria. Una entrada
 * sin `role` es heredada y cuenta como secundaria (contrato del schema). Sin
 * fuentes primarias, el publicador del `source_url` heredado es la única
 * atribución; con ellas, `source_url` no se reinterpreta como cobertura
 * porque puede ser el enlace al propio estudio (p. ej. un DOI).
 */
export function resolveSourceAttribution(
  post: Pick<Post, 'source_url' | 'sources'>
): SourceAttribution {
  const sources = post.sources ?? [];
  const primary: string[] = [];
  for (const source of sources) {
    if (source.role !== 'primary') continue;
    const name = publisherOf(source);
    if (name && !primary.includes(name)) primary.push(name);
  }

  const secondary = sources.find((source) => source.role !== 'primary');
  let coverage: string | null;
  if (secondary) {
    coverage = publisherOf(secondary);
  } else {
    coverage = primary.length > 0 ? null : resolveSourcePublisher(post);
  }
  return { primary, coverage: coverage && !primary.includes(coverage) ? coverage : null };
}

/**
 * Título legible para el enlace de fuente cuando el post no trae `sources`
 * estructuradas: usa el publicador resoluble desde `source_url`, o el
 * hostname desnudo si el dominio no está en el mapa; solo cae al texto
 * genérico cuando no hay URL de la que derivar nada. Nunca expone el
 * `refinery_id` crudo como texto de enlace.
 */
export function resolveSourceTitle(post: Pick<Post, 'source_url'>): string {
  return resolveSourcePublisher(post) ?? 'Fuente original';
}
