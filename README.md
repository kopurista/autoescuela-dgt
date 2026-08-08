# Autoescuela DGT — Permiso B

Aplicación web para preparar el examen teórico del permiso B. Se instala en la
pantalla de inicio del móvil y funciona sin conexión.

**480 preguntas** repartidas en 9 temas, con las **señales oficiales**,
corrección explicada, banco de fallos con repetición espaciada y análisis de en
qué apartados fallas más.

## Modos

- **Test por temas** — practicar un tema concreto.
- **Test aleatorio** — 20 preguntas de todo el temario, con corrección al momento.
- **Examen oficial DGT** — 30 preguntas, 30 minutos, máximo 3 fallos. No corrige
  hasta el final y no muestra el marcador mientras dura, igual que el examen real.
- **Test de fallos** — solo las preguntas pendientes. Una entra al fallarla y sale
  cuando la aciertas dos veces seguidas.

El progreso se guarda en el propio navegador del dispositivo. No hay cuentas, ni
servidor, ni se envía nada a ninguna parte.

## Sobre el contenido

Las preguntas están redactadas para este proyecto, en el formato del examen
oficial y conforme a la normativa vigente (Reglamento General de Circulación,
límites urbanos 20/30/50, baliza V-16, reforma del sistema de puntos de 2022).
**No reproducen ningún cuestionario comercial.**

Las imágenes de las señales proceden del **Catálogo de señales, Tomo I, anexo al
Real Decreto 465/2025**, que es contenido normativo público. Cada una conserva su
código oficial (`R-101`, `P-18`, `S-30a`…) y su denominación literal.

Las marcas viales y las señales con panel complementario están dibujadas
específicamente para este proyecto, porque el Tomo I no las recoge.

Esto es material de estudio, no una fuente normativa. Ante cualquier duda, manda
el texto oficial publicado en el BOE.

## Desarrollo

`datos/` no se edita a mano: se genera desde la versión de escritorio con
`generar_datos.py`. Al cambiar el contenido hay que subir el número de `VERSION`
en `sw.js` para que los dispositivos que ya tengan la app descarguen lo nuevo.

Para servirla en local: `python servir.py`
