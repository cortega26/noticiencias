---
title: 'La Paradoja Inesperada: Actualizar una IA con Nuevos Datos Puede Intensificar sus ''Alucinaciones'''
schema_version: 2
date: 2024-07-07
author: Noticiencias AI
categories:
- Tecnología
permalink: ciencia/2024-07-07-la-paradoja-inesperada-actualizar-una-ia-con-nuevos-datos-puede-intensificar-sus-alucinaciones
tags:
- modelo lenguaje grande
- alucinación ia
- ajuste fino
- precisión ia
- honestidad computacional
excerpt: 'Una paradoja sorprendente: enseñar nuevos hechos a una IA puede aumentar sus ''alucinaciones''. Clave para desarrollar modelos de lenguaje fiables y precisos.'
image: "~/assets/images/default.png"
image_alt: "La Paradoja Inesperada: Actualizar una IA con Nuevos Datos Puede Intensificar sus ''Alucinaciones''"
source_url: https://lilianweng.github.io/posts/2024-07-07-hallucination/
refinery_id: Extrinsic Hallucinations in LLMs
headlines_variants:
  question: ¿Podría la actualización de una IA con hechos novedosos hacerla más propensa a 'alucinar'?
  benefit: 'Garantiza IA más Confiable: Descubre cómo las actualizaciones afectan su tendencia a ''alucinar'' información.'
---

# La Paradoja de la Actualización: Cuando Enseñar Hechos Nuevos a una IA la Vuelve Más Propensa a "Alucinar"

Los modelos de lenguaje grandes (LLM) nos asombran con su capacidad para generar texto coherente y, a menudo, factual. Sin embargo, no es raro que "alucinen", es decir, que inventen información que no tiene sustento en la realidad o en su contexto. Intuitivamente, esperaríamos que, si los "actualizamos" con nuevos conocimientos a través de técnicas como el ajuste fino (fine-tuning), se volverían más precisos y menos propensos a este problema.

Pero, ¿qué pasaría si, al intentar enseñarles hechos novedosos, en realidad los hiciéramos *más* propensos a fabricar información? Esta es una de las paradojas que los científicos de datos están empezando a desentrañar, revelando una limitación inesperada en cómo estas inteligencias artificiales asimilan el conocimiento y abriendo una fascinante área de investigación sobre la "honestidad intelectual" de las máquinas.

## Descifrando las "Alucinaciones Extrínsecas"

Para entender esta paradoja, primero debemos precisar qué significa realmente una "alucinación" en el contexto de un LLM. El término se ha usado ampliamente para cualquier tipo de error, pero para un análisis riguroso, es útil diferenciar.

Consideremos dos tipos principales de alucinaciones:

*   **Alucinación en contexto:** El LLM recibe un texto fuente, pero su respuesta contradice o inventa detalles de ese mismo texto.
*   **Alucinación extrínseca:** Este es el foco de nuestra exploración. Aquí, el LLM genera información que no está fundamentada ni en el contexto que le proporcionamos, ni en el vasto "conocimiento del mundo" que adquirió durante su preentrenamiento. Es, en esencia, fabricar un "hecho" que no existe o es incorrecto, incluso si no había un contexto directo que lo contradijera.

El desafío con las alucinaciones extrínsecas es doble: queremos que los LLM sean factuales y precisos, pero también que reconozcan humildemente cuándo no saben la respuesta, en lugar de inventarla. La gran pregunta es: ¿por qué un modelo, diseñado para aprender de datos masivos, se desvía de la verdad?

## La Causa Raíz: Datos Imperfectos y la Sorpresa del Ajuste Fino

Los LLM se entrenan con volúmenes colosales de texto de internet, una fuente que, por su propia naturaleza, es imperfecta. Contiene información desactualizada, incompleta o directamente incorrecta. Si un modelo memoriza por error esta información defectuosa durante su preentrenamiento, naturalmente cometerá errores.

Sin embargo, el verdadero giro narrativo, lo que cuestiona nuestra intuición, aparece en la etapa del ajuste fino. Tras el preentrenamiento, los LLM a menudo pasan por un ajuste fino, un proceso donde se "refinan" con datos más específicos para mejorar capacidades como seguir instrucciones o interactuar de manera más útil (a menudo utilizando el Aprendizaje por Refuerzo a partir de la Retroalimentación Humana, o RLHF).

Aquí surge la pregunta clave: ¿qué sucede cuando intentamos introducir **nuevos conocimientos** durante este ajuste fino? Intuitivamente, pensaríamos que esto mejoraría la factualidad del modelo. Pero un estudio reciente de Gekhman et al. (2024) revela algo sorprendente:

## El Hallazgo Inesperado: Enseñar lo Nuevo Aumenta las Alucinaciones

Los investigadores de Gekhman et al. (2024) diseñaron experimentos para ver cómo los LLM aprenden nuevos conocimientos durante el ajuste fino y el impacto de este proceso en las alucinaciones. Clasificaron el conocimiento de un modelo en categorías, desde "Altamente Conocido" hasta "Desconocido", basándose en su probabilidad de generar respuestas correctas a preguntas de libro cerrado.

Sus observaciones fueron contraintuitivas:

1.  **Lentitud en el aprendizaje:** Los LLM aprenden ejemplos con **conocimientos nuevos o "desconocidos"** sustancialmente más lento que los ejemplos que refuerzan información ya consistente con su conocimiento preexistente.
2.  **El riesgo de la actualización:** Una vez que estos ejemplos de "conocimiento desconocido" son eventualmente aprendidos, **aumentan la tendencia general del modelo a alucinar**. Es decir, intentar "poner al día" al modelo con hechos que no estaban en su preentrenamiento puede hacer que se desvíe más de la verdad en otros ámbitos.

Esto sugiere una delicada balanza: el mejor rendimiento se logró cuando el LLM se ajustó a la mayoría de los ejemplos "conocidos", pero solo a unos pocos de los "desconocidos". Si se le forzaba a aprender demasiados hechos nuevos, el modelo empezaba a inventar.

Este hallazgo es una advertencia importante: el ajuste fino, una herramienta poderosa para mejorar los LLM, puede ser un arma de doble filo cuando se trata de infundir nuevos datos factuales. No es simplemente una "actualización de base de datos"; es una compleja remodelación del "cerebro" de la IA.

## La Frontera: Detectar y Limitar la Fabricación de Hechos

Si introducir nuevos conocimientos conlleva el riesgo de aumentar las alucinaciones, la investigación se ha volcado en dos frentes cruciales: cómo detectar cuándo un LLM está alucinando y cómo construirlo para que sea más fiable y autoconsciente.

### Detectando la Fantasía Factual

La detección de alucinaciones extrínsecas es un campo en rápida evolución. Los enfoques se dividen principalmente en aquellos que aumentan la evaluación con información externa y aquellos que confían en la auto-consistencia del modelo.

*   **Evaluación aumentada por recuperación:**
    *   **FactualityPrompt (Lee et al., 2022):** Este benchmark utiliza documentos o frases de Wikipedia como "verdad fundamental" para verificar la factualidad. Mide los errores en entidades nombradas o la proporción de frases que implican una correspondencia con el conocimiento de Wikipedia.
    *   **FActScore (Min et al., 2023):** Descompone una generación larga del LLM en "hechos atómicos" y valida cada uno contra una base de conocimiento (como Wikipedia). Se ha demostrado que el uso de la recuperación mejora significativamente la reducción de alucinaciones.
    *   **SAFE (Wei et al., 2024):** Va un paso más allá. Para cada hecho atómico, SAFE utiliza un LLM como agente para generar consultas de búsqueda de Google de forma iterativa y luego razona si los resultados de búsqueda respaldan el hecho. Sorprendentemente, se encontró que SAFE supera a los anotadores humanos con una eficiencia 20 veces mayor.
    *   **FacTool (Chern et al., 2023):** Este marco sigue un flujo de trabajo estándar de verificación de hechos: extrae afirmaciones, las convierte en consultas para herramientas externas (motores de búsqueda, intérpretes de código, etc.), recolecta evidencia y verifica el acuerdo.

*   **Detección basada en muestreo (SelfCheckGPT, Manakul et al., 2023):** En contraste con los métodos anteriores que requieren bases de conocimiento externas, SelfCheckGPT funciona como una "caja negra". Genera múltiples muestras de un LLM para la misma instrucción y verifica la consistencia entre ellas. Si el modelo genera respuestas muy diferentes para la misma pregunta, es una señal de incertidumbre o posible alucinación.

### El Desafío de Saber Cuándo "No Saber"

Tan importante como ser factual es que un LLM sepa cuándo carece de información y pueda indicarlo, en lugar de inventar una respuesta. Esto se conoce como "calibración del conocimiento desconocido".

*   **TruthfulQA (Lin et al., 2021):** Este benchmark está diseñado adversarialmente con preguntas que se basan en conceptos erróneos humanos comunes (ej. "Las tres leyes de la robótica son reales"). Mide la capacidad del modelo para evitar afirmaciones falsas, incluso si eso significa negarse a responder o dar una respuesta irrelevante pero veraz. Sorprendentemente, los modelos más grandes a veces eran *menos* veraces en este benchmark, mostrando que pueden aprender y perpetuar falsedades humanas comunes.
*   **SelfAware (Yin et al., 2023):** Contiene preguntas sin respuesta (por falta de consenso científico, subjetividad, etc.) y con respuesta, para medir si los modelos pueden clasificar correctamente lo que saben de lo que no saben. Los modelos más grandes mostraron una mejor capacidad en esta autoconciencia.
*   **Calibración de la confianza:** Estudios como los de Kadavath et al. (2022) y Lin et al. (2022) exploran si los LLM están bien "calibrados", es decir, si la probabilidad que asignan a una respuesta es un reflejo preciso de cuán a menudo esa respuesta es correcta. Los LLM más grandes tienden a estar mejor calibrados, aunque el ajuste fino con RLHF puede descalibrarlos.

*   **Consulta indirecta (Agrawal et al., 2023):** Para detectar referencias alucinadas (libros o artículos inventados), es más efectivo pedir al modelo detalles auxiliares (como los autores de un supuesto estudio) que preguntar directamente si la referencia existe. La probabilidad de que un modelo alucine los mismos autores para una referencia falsa es menor, lo que lo convierte en un método de verificación más robusto.

### Métodos Anti-Alucinación: Construyendo la Fiabilidad

Más allá de la detección, los investigadores están desarrollando técnicas para prevenir activamente las alucinaciones.

*   **Generación Aumentada por Recuperación (RAG):** Este es un pilar fundamental. En lugar de depender únicamente de su conocimiento interno, el LLM primero "busca" documentos relevantes en una base de conocimiento externa y luego genera su respuesta utilizando esos documentos como contexto.
    *   **RARR (Gao et al., 2022):** Este marco de "Atribución Retrofit Mediante Investigación y Revisión" investiga activamente el texto generado por un LLM, busca evidencia y luego lo revisa para corregir cualquier contenido no respaldado.
    *   **FAVA (Mishra et al., 2024):** Similar a RARR, pero entrena un "editor" que aprende a corregir errores alucinatorios, incluso generando datos de entrenamiento sintéticos insertando errores en respuestas correctas.
    *   **Rethinking with Retrieval (RR, He et al., 2022):** Este método genera múltiples rutas de razonamiento para una pregunta, recupera conocimiento externo para cada explicación y luego selecciona la respuesta más fiel basándose en qué tan bien se alinea con la evidencia recuperada.
    *   **Self-RAG (Asai et al., 2024):** Entrena un LLM para "reflexionar" sobre su propia generación. Mediante "tokens de reflexión" especiales, decide cuándo recuperar documentos en paralelo y luego "critica" su propia respuesta para mejorar la calidad y la factualidad.

## El Camino Hacia la Verdad en la IA

La búsqueda de LLM que sean consistentemente factuales y que reconozcan los límites de su propio conocimiento es una de las áreas más apasionantes y fundamentales de la investigación en IA. Como hemos visto, la intuición de que "más datos" o "más entrenamiento" siempre equivale a "más verdad" es incompleta. La paradoja de que enseñar nuevos hechos puede, irónicamente, aumentar la propensión a alucinar nos obliga a repensar fundamentalmente cómo construimos y calibramos estas poderosas herramientas.

El interés no reside en la exageración, sino en la complejidad inherente: no basta con que un LLM "sepa"; debe saber *lo que sabe*, *lo que no sabe* y, crucialmente, ser capaz de *demostrarlo*. Los enfoques actuales, que combinan la búsqueda externa de información, la autoevaluación y la calibración de la confianza, nos acercan a un futuro donde la IA no solo nos informa, sino que lo hace con una honestidad intelectual sin precedentes. Sin embargo, este es un viaje en curso, lleno de desafíos cognitivos que aún esperan ser resueltos.

Fuente original: [https://lilianweng.github.io/posts/2024-07-07-hallucination/](https://lilianweng.github.io/posts/2024-07-07-hallucination/)

<!-- source_identity: source_id=lilian_weng; source_name=Lil'Log -->
