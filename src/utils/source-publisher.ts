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
    return null;
  }

  return hostnameToPublisher[hostname] ?? hostname;
}
