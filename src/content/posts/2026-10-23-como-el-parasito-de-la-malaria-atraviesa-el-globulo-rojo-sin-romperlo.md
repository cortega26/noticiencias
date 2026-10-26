---
title: Cómo el parásito de la malaria abre un portal en la sangre y lo cierra sin rastro
schema_version: 2
date: 2026-10-23
author: Noticiencias AI
categories:
  - Ciencia
tags:
  - malaria
  - plasmodium
  - criomicroscopía
  - moving junction
  - inhibidor proteico
excerpt: Criomicroscopía revela la estructura del portal que usa Plasmodium para invadir células; un inhibidor lo bloquea en cultivo, pero falta probarlo in vivo.
image: ~/assets/images/2026-10-23-malaria-parasite-caught-in-the-act-of-breaking-and-entering.png
image_alt: 'Ilustración generada con IA: el parásito de la malaria atraviesa la membrana de un glóbulo rojo a través de un anillo de unión.'
source_url: https://quantamagazine.org/malaria-parasite-caught-in-the-act-of-breaking-and-entering-20261023/
refinery_id: '4021'
headlines_variants:
  question: ¿Cómo logra la malaria entrar en los glóbulos rojos sin romperlos?
  benefit: Un nuevo blanco para frenar la malaria antes de que invada la sangre
summary_points:
  - El laboratorio de Chi-Min Ho en la Universidad de Columbia obtuvo imágenes de criomicroscopía electrónica de la unión móvil (moving junction) de Plasmodium en el momento exacto de la invasión del glóbulo rojo.
  - El parásito inyecta tres proteínas que forman una cuña densa bajo la membrana del huésped y una cuarta que la conecta al cuerpo del invasor; juntas generan fuerzas electrostáticas y presión mecánica que invierten la curvatura de la membrana.
  - Con la estructura resuelta, el equipo diseñó mediante inteligencia artificial una proteína inhibidora que encaja en la unión móvil y la bloquea en cultivos de laboratorio.
  - El mecanismo de invasión mediante unión móvil parece conservado en otros apicomplejos como Toxoplasma gondii y Cyclospora, lo que sugiere un blanco terapéutico de amplio espectro.
  - El siguiente objetivo del laboratorio son los complejos adhesivos que el parásito instala en la superficie del glóbulo rojo infectado para evitar el bazo y causar la patología grave.
glossary:
  - term: Plasmodium
    definition: Género de protozoarios parásitos unicelulares causantes de la malaria; se replican dentro de los glóbulos rojos humanos.
  - term: Unión móvil (moving junction)
    definition: Estructura transitoria en forma de anillo que el parásito crea en la membrana del glóbulo rojo para abrir un poro, deslizarse y cerrarlo sin dejar rastro.
  - term: Apicomplejos
    definition: Filo de parásitos unicelulares que incluye a Plasmodium, Toxoplasma gondii y Cyclospora; comparten un aparato apical especializado para invadir células huésped.
  - term: Criotomografía electrónica
    definition: Técnica de imagen que congela muestras biológicas en hielo vítreo y reconstruye su estructura tridimensional a resolución molecular.
  - term: Proteínas adhesivas de superficie (PfEMP1)
    definition: Proteínas que el parásito exporta a la membrana del glóbulo rojo infectado para adherirlo al endotelio vascular y evitar su eliminación en el bazo; causan la gravedad clínica.
fact_check:
  - label: La malaria mata aproximadamente 600.000 personas al año, la mayoría niños en África subsahariana
    status: uncertain
  - label: Plasmodium invade glóbulos rojos creando una unión móvil que se abre y cierra en menos de un minuto
    status: uncertain
  - label: El laboratorio de Ho resolvió la estructura molecular de los cuatro componentes proteicos de cada anclaje de la unión móvil mediante criotomografía electrónica
    status: confirmed
  - label: El parásito inyecta tres proteínas que forman una cuña densa bajo la membrana y una cuarta que conecta la cuña con el cuerpo del invasor
    status: confirmed
  - label: Una proteína inhibidora diseñada por IA bloquea la unión móvil en cultivos de laboratorio
    status: uncertain
  - label: La invasión es un blanco terapéutico difícil porque es un proceso muy breve
    status: uncertain
  - label: Toxoplasma gondii usa el mismo equipamiento bioquímico para invadir células que Plasmodium
    status: uncertain
  - label: Las proteínas adhesivas en la superficie del glóbulo rojo infectado causan los síntomas más graves (angustia orgánica, convulsiones, coma)
    status: uncertain
why_it_matters:
  - La estructura atómica de la unión móvil permite el diseño racional de fármacos que bloqueen la entrada del parásito, un cuello de botella donde la resistencia sería más difícil de evolucionar.
  - El mecanismo conservado en apicomplejos abre la posibilidad de inhibidores de amplio espectro contra malaria, toxoplasmosis y ciclosporiasis.
  - El blanco de las proteínas adhesivas (PfEMP1) ofrece una estrategia para prevenir la patología grave incluso tras la infección establecida.
confidence: Moderada — noticia en Quanta Magazine sobre un estudio estructural reciente (2026) de un solo laboratorio; la resolución de la unión móvil es un avance técnico notable, pero el inhibidor solo se probó in vitro y no hay confirmación independiente ni datos en modelos animales o humanos
sources:
  - title: Malaria Parasite Caught in the Act of Breaking and Entering
    url: https://quantamagazine.org/malaria-parasite-caught-in-the-act-of-breaking-and-entering-20261023/
    publisher: Quanta Magazine
    date: '2026-10-23'
requires_uncertainty_note: true
uncertainty_note: El inhibidor solo se probó en cultivos celulares; su seguridad y eficacia en animales o humanos es desconocida, y la ventana de 60 segundos para actuar es un reto farmacológico mayor.
social:
  publish: true
  id: 2e8a5803aff8ae2fa40038d11f17f0d03fc85e593d2dbe979c5cdd83b2ba52f9
---

El parásito de la malaria tiene una llave maestra que nadie había visto en acción. Hasta ahora.

Cada vez que _Plasmodium_ entra en un glóbulo rojo, construye un portal temporal en la membrana de la célula, se desliza por él y lo cierra detrás de sí sin dejar rastro. El proceso dura menos de un minuto. Durante décadas, los biólogos supieron que ocurría —habían visto el engrosamiento de la membrana al microscopio electrónico en los años setenta—, pero la estructura molecular del portal y el mecanismo exacto seguían siendo invisibles. Sin esa imagen, buscar fármacos que bloquearan la entrada era disparar a ciegas.

## El hueso duro de la invasión

La malaria mata unas seiscientas mil personas al año, la mayoría niños en África subsahariana. Los tratamientos de primera línea —cloroquina, sulfadoxina-pirimetamina— atacan al parásito una vez que ya está dentro del glóbulo rojo y se replica. Pero _Plasmodium_ desarrolla resistencia rápido. La invasión es un cuello de botella atractivo: si impides que el parásito entre, detienes la infección antes de que empiece. El problema era que nadie sabía cómo era la cerradura.

El parásito llega al glóbulo rojo con todo su equipamiento listo. En su superficie expresa proteínas que funcionan como ganchos. En la membrana de la célula huésped inserta un anillo de anclajes proteicos: la _unión móvil_ (_moving junction_). Esos anclajes forman un portal continuo por el que el parásito se cuela. Una vez dentro, la membrana se sella. El parásito no revienta la célula; la remodela desde dentro para que no delate su presencia.

## Lo que vio el laboratorio de Chi-Min Ho

El equipo de Ho, en la Universidad de Columbia, usó criomicroscopía electrónica para congelar el instante exacto de la invasión y resolver la estructura de los cuatro componentes proteicos de cada anclaje. Lo que encontraron cambia el modelo mental: no es un simple anillo pasivo. El parásito inyecta tres proteínas en el glóbulo rojo que se ensamblan en una cuña densa bajo la membrana; una cuarta proteína conecta esa cuña con el cuerpo del invasor. Al colocar muchos de estos anclajes uno al lado del otro, las proteínas generan fuerzas electrostáticas y presión mecánica que aglomeran los lípidos de la membrana, invierten su curvatura y la doblan hacia adentro alrededor del parásito. Algunos lípidos se desprenden y reensamblan formando una envoltura protectora para el invasor. Cuando el parásito termina de pasar, la membrana se reforma y sella.

"Es un ejemplo realmente bueno de cómo un campo ha avanzado paso a paso hacia una observación realmente potente", dice Jake Baum, parasitólogo de la Universidad de Nueva Gales del Sur, ajeno al estudio. "Al final del día, esto no es biología molecular. Es biofísica".

## De la estructura a un inhibidor —en tubo de ensayo

Con la estructura en la mano, el equipo de Ho usó una plataforma de diseño de proteínas asistida por inteligencia artificial para crear una proteína inhibidora que encaja en la unión móvil y la bloquea. En cultivos de laboratorio, _Plasmodium_ no logra entrar en los glóbulos rojos. Pero —y esto es crucial— la seguridad y la eficacia no se han probado en modelos animales, y mucho menos en humanos. La unión móvil es un blanco fugaz: cualquier fármaco que la ataque tiene una ventana de unos sesenta segundos para actuar antes de que el portal se cierre. Eso exige una molécula extremadamente estable en sangre o de acción ultra-rápida, o ambas cosas. Christiaan van Ooij, de la Universidad de Keele, lo resume: "Algunos siempre han argumentado que la invasión es un blanco terapéutico realmente malo porque es un proceso muy breve".

## Una llave para más puertas

_Plasmodium_ pertenece a los apicomplejos, un filo que incluye a _Toxoplasma gondii_ (parásito de gatos que infecta humanos) y _Cyclospora_ (causante de diarrea severa). Todos parecen usar el mismo equipamiento bioquímico para invadir células. Un artículo de 2026 describió cómo _Toxoplasma_ detecta el momento exacto para desplegar su unión móvil; _Plasmodium_ podría operar igual. Entender uno ilumina a los otros.

## Lo que queda por resolver

El laboratorio de Ho ya apunta a las siguientes "ballenas blancas": los complejos proteicos que el parásito instala en la superficie del glóbulo rojo infectado para que esta se pegue a las paredes de los vasos sanguíneos y evite el bazo. Esas proteínas adhesivas son las que causan los síntomas más graves —angustia orgánica, convulsiones, coma—. Bloquearlas podría evitar la patología aunque el parásito ya esté dentro.

La imagen del portal molecular ya no es un misterio. Ahora la pregunta es si podemos fabricar una llave que encaje en la cerradura el tiempo suficiente, en un cuerpo humano, sin romper nada más.

<!-- source_identity: source_id=quanta_magazine; source_name=Quanta Magazine -->
