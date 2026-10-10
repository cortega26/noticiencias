import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function page(name: string) {
  return readFileSync(fileURLToPath(new URL(`../src/pages/${name}.md`, import.meta.url)), 'utf8');
}

describe('published trust and AdSense disclosures', () => {
  it('offers a contact route with a named accountable operator and usable mailto links', () => {
    const contact = page('contacto');
    expect(contact).toContain('permalink: /contacto/');
    expect(contact).toContain('Carlos Ortega');
    expect(contact).toContain('mailto:carlos@tooltician.com');
    expect(contact).toContain('/reportar-problema/');
  });

  it('accurately discloses the pre-consent analytics load and AdSense readiness', () => {
    const privacy = page('privacidad');
    expect(privacy).toContain('Consent Mode v2');
    expect(privacy).toContain('incluso antes de aceptar o rechazar');
    expect(privacy).toContain('Cloudflare Web Analytics');
    expect(privacy).toContain('Buttondown');
    expect(privacy).toContain('no hemos habilitado anuncios programáticos');
    expect(privacy).toContain('https://policies.google.com/technologies/partner-sites');
    expect(privacy).toContain('mailto:carlos@tooltician.com');
  });

  it('publishes consistent public accountability, not generic legal boilerplate', () => {
    for (const name of ['nosotros', 'transparencia', 'terminos']) {
      const document = page(name);
      expect(document).toContain('Carlos Ortega');
      expect(document).toContain('/contacto/');
      expect(document).not.toContain('[País de Operación');
      expect(document).not.toContain('[Nombre de la Empresa');
    }
    expect(page('nosotros')).toContain('no es una validación científica independiente');
    expect(page('transparencia')).toContain('comprobación humana individual');
  });
});
