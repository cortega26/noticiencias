---
layout: splash
title: "Traduce la ciencia. Sin humo."
permalink: /
header:
  overlay_color: "#000"
  overlay_filter: 0.35
  overlay_image: "/assets/images/hero.jpg" # agrega esta imagen
  actions:
    - label: "Explorar artículos"
      url: "/categorias/"
    - label: "Buscar"
      url: "/buscar/"
excerpt: "Hallazgos científicos explicados con rigor y en buen español."
intro:
  - excerpt: "Publicamos resúmenes claros y honrados de papers y avances verificados — con enlaces a las fuentes originales."
feature_row:
  - title: "Curaduría rigurosa"
    excerpt: "Seleccionamos por **novedad**, **autoridad** y **relevancia**."
    icon: beaker
  - title: "Sin hype"
    excerpt: "Nada de clickbait. Ideas y límites en contexto."
    icon: activity
  - title: "Fuentes trazables"
    excerpt: "Cada pieza enlaza al trabajo original (DOI/Preprint)."
    icon: link
cta_row:
  - title: "Suscríbete al boletín"
    excerpt: "Recibe lo mejor de la semana."
    url: "/about/"
    btn_label: "Quiero suscribirme"
    btn_class: "btn--primary"
---


{% include feature_row id="intro" type="center" %}

{% include feature_row %}

{% include feature_row id="cta_row" %}

<div class="archive latest-news">
  <h3 class="archive__subtitle">Últimas Noticias</h3>
  <div class="grid__wrapper latest-news__grid">
    {% for post in site.posts limit:4 %}
      {% include archive-single.html type="grid" %}
    {% endfor %}
  </div>
</div>
