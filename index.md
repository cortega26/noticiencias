---
layout: splash
title: "Noticiencias"
permalink: /
excerpt: "Ciencia global explicada con rigor, trazabilidad y criterio editorial."
---

<section class="newsroom-hero" aria-labelledby="newsroom-hero-title">
  <p class="newsroom-hero__eyebrow">Sala de redaccion</p>
  <h1 id="newsroom-hero-title" class="newsroom-hero__title">Traduce la ciencia. Sin humo.</h1>
  <p class="newsroom-hero__lede">
    Informes claros, verificados y editados con criterio. Cada historia enlaza sus fuentes,
    explicita su metodo y marca su nivel de confianza.
  </p>
  <div class="newsroom-hero__actions">
    <a href="/categorias/#investigaciones" class="btn btn--primary btn--large">Explorar investigaciones</a>
    <a href="/methodology/" class="btn btn--light-outline btn--large">Como trabajamos</a>
  </div>
  <div class="newsroom-hero__stats">
    <div class="newsroom-stat">
      <div class="newsroom-stat__label">Verificacion</div>
      <div class="newsroom-stat__value">Fuentes trazables</div>
    </div>
    <div class="newsroom-stat">
      <div class="newsroom-stat__label">Edicion</div>
      <div class="newsroom-stat__value">Rigor editorial</div>
    </div>
    <div class="newsroom-stat">
      <div class="newsroom-stat__label">Transparencia</div>
      <div class="newsroom-stat__value">Metodologia publica</div>
    </div>
  </div>
</section>

<section class="newsroom-section" aria-labelledby="featured-title">
  <h2 id="featured-title" class="newsroom-section__title">Investigaciones destacadas</h2>
  {% assign featured_posts = site.posts | where: "investigation", true | where: "featured", true %}
  {% if featured_posts.size == 0 %}
    {% assign featured_posts = site.posts | where: "featured", true %}
  {% endif %}
  {% if featured_posts.size == 0 %}
    {% assign featured_posts = site.posts %}
  {% endif %}
  <div class="newsroom-featured">
    {% for post in featured_posts limit: 3 %}
      {% assign teaser = post.header.teaser | default: post.image | default: site.teaser %}
      <article class="newsroom-card">
        <div class="newsroom-card__image">
          <img src="{{ teaser | relative_url }}" alt="{{ post.image_alt | default: post.title }}" loading="lazy">
        </div>
        <div class="newsroom-card__body">
          <span class="newsroom-kicker">{{ post.categories[0] | default: "Investigacion" }}</span>
          <h3 class="newsroom-card__title">
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
          </h3>
          <div class="newsroom-card__meta">
            {% assign date_format = site.date_format | default: "%B %-d, %Y" %}
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: date_format }}</time>
          </div>
          {% if post.excerpt %}
            <p>{{ post.excerpt | markdownify | strip_html | truncate: 160 }}</p>
          {% endif %}
        </div>
      </article>
    {% endfor %}
  </div>
</section>

<section class="newsroom-section" aria-labelledby="latest-title">
  <h2 id="latest-title" class="newsroom-section__title">Titulares recientes</h2>
  <div class="newsroom-latest">
    {% for post in site.posts limit: 6 %}
      <article class="newsroom-card newsroom-card--compact">
        <div class="newsroom-card__body">
          <span class="newsroom-kicker">{{ post.categories[0] | default: "Ciencia" }}</span>
          <h3 class="newsroom-card__title">
            <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
          </h3>
          <div class="newsroom-card__meta">
            {% assign date_format = site.date_format | default: "%B %-d, %Y" %}
            <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: date_format }}</time>
            {% if post.confidence %}
              · Confianza {{ post.confidence }}
            {% endif %}
          </div>
        </div>
      </article>
    {% endfor %}
  </div>
</section>

<section class="newsroom-section" aria-labelledby="categories-title">
  <h2 id="categories-title" class="newsroom-section__title">Navega por categorias</h2>
  <nav class="newsroom-category-nav" aria-label="Categorias principales">
    {% assign sorted_categories = site.categories | sort %}
    {% for category in sorted_categories %}
      <a href="/categorias/#{{ category[0] | slugify }}">{{ category[0] }} ({{ category[1].size }})</a>
    {% endfor %}
  </nav>
</section>

<section class="newsroom-section newsroom-newsletter" aria-labelledby="newsletter-title">
  <div>
    <h2 id="newsletter-title" class="newsroom-section__title">Boletin editorial</h2>
    <p>Un resumen semanal con lo mas relevante, sin ruido y con links a las fuentes.</p>
  </div>
  <form action="https://www.noticiencias.com/newsletter/" method="post">
    <label for="newsletter-email">Correo de suscripcion</label>
    <input id="newsletter-email" name="email" type="email" placeholder="tu@email.com" required>
    <button class="btn btn--primary" type="submit">Suscribirme</button>
  </form>
</section>

<section class="newsroom-section newsroom-transparency" aria-labelledby="transparency-title">
  <h2 id="transparency-title" class="newsroom-section__title">Transparencia editorial</h2>
  <p>
    Cada pieza indica sus fuentes, metodo de traduccion y nivel de confianza.
    Conoce nuestro sistema de verificacion y politica de correcciones.
  </p>
  <div>
    <a href="/transparency/" class="btn btn--light-outline">Ver transparencia</a>
  </div>
</section>
