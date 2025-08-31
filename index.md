---
layout: home
title: "Inicio"
feature_row:
  - image_path: /assets/images/placeholder1.jpg # TODO: agregar imagen 800x450
    alt: "Ejemplo 1"
    title: "Destacado 1"
    excerpt: "Descripción breve del artículo destacado 1."
    url: /ciencia/
  - image_path: /assets/images/placeholder2.jpg # TODO: agregar imagen 800x450
    alt: "Ejemplo 2"
    title: "Destacado 2"
    excerpt: "Descripción breve del artículo destacado 2."
    url: /salud/
  - image_path: /assets/images/placeholder3.jpg # TODO: agregar imagen 800x450
    alt: "Ejemplo 3"
    title: "Destacado 3"
    excerpt: "Descripción breve del artículo destacado 3."
    url: /tecnologia/
---

{% include feature_row %}

## Ciencia
{% include posts-category.html category="ciencia" %}

## Salud
{% include posts-category.html category="salud" %}

## Tecnología
{% include posts-category.html category="tecnologia" %}

