# Autoescuela DGT — versión móvil

Una PWA: una web que se guarda en la pantalla de inicio del móvil y funciona
como una app. Misma lógica que la versión de escritorio (los cuatro modos de
test, el banco de fallos y el análisis), el mismo banco de **680 preguntas** y
las **señales oficiales**.

Funciona en Android y en iPhone, y no hace falta instalar nada en el ordenador
para usarla.

**Lo que todavía NO hace: bloquear el móvil.** Es la fase siguiente y solo es
posible en Android. Hay una sección sobre eso al final.

---

## Está publicada aquí

### https://kopurista.github.io/autoescuela-dgt/

Abre esa dirección en el móvil e instálala en la pantalla de inicio:

- **Android (Chrome):** menú ⋮ → *Instalar aplicación* (o *Añadir a pantalla de
  inicio*).
- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

Una vez instalada funciona **sin conexión** y sin depender del ordenador: la
primera visita descarga las 680 preguntas y las 123 señales (unos 5 MB) y las
guarda en el móvil.

El progreso se guarda en el propio dispositivo.

### Publicar los cambios

El repositorio es `kopurista/autoescuela-dgt` y esta carpeta **es** ese
repositorio. Después de regenerar el contenido:

```bash
git add -A
git commit -m "Preguntas nuevas"
git push
```

Pages reconstruye el sitio en un par de minutos.

---

## Servirla en local (para desarrollo)

`python servir.py`, o doble clic en `Abrir en el movil.bat`. Te da una
dirección `http://192.168…` accesible desde el móvil por wifi.

Ojo: por wifi la aplicación **funciona pero no se guarda sin conexión**. El
guardado offline lo hace un *service worker* y los navegadores solo lo
permiten en un **contexto seguro**: HTTPS, `localhost` o `127.0.0.1`. Una IP
de red local no es ninguna de las tres. El código lo detecta y no intenta
registrarlo, así que no falla nada. Para el uso diario, usa la dirección de
GitHub Pages.

---

## Regenerar el contenido

La carpeta `datos/` no se edita a mano: sale de las preguntas de escritorio.
Cuando añadas o cambies preguntas en `preguntas/*.json`:

```bash
python movil/generar_datos.py
```

Eso vuelve a construir `datos/banco.json` y copia solo las señales que alguna
pregunta utiliza. Las señales oficiales se copian del catálogo; las que están
dibujadas con código en `dgtapp/senales.py` (marcas viales, señales con panel,
límites con una cifra concreta) se rasterizan a PNG con ese mismo código, para
no tener que reprogramarlas en JavaScript y que no puedan quedar distintas.

Después, sube el número de `VERSION` en `sw.js` para que los móviles que ya
tengan la app guardada se descarguen la versión nueva.

Los iconos se regeneran con `python movil/generar_iconos.py`, y solo hace falta
si quieres cambiarlos.

---

## El progreso es independiente

Cada móvil guarda su progreso en su propio navegador, y no se comunica con el
del ordenador. Son tres historiales separados.

Unificarlos exige un servidor con base de datos y cuentas de usuario. Es
perfectamente posible, pero es otro proyecto: por ahora, si quieres que el
banco de fallos sea uno solo, usa un único dispositivo para hacer los tests.

Para vaciar el progreso de un móvil: Estadísticas → *Borrar todo mi progreso*.

---

## La fase siguiente: bloquear el móvil

Solo tiene sentido plantearlo en **Android**. En iPhone una app no puede
abrirse sola: no existe la API y no la va a haber, así que lo máximo sería una
notificación que tienes que pulsar tú, y eso pierde justo lo que hace que esto
funcione.

En Android sí, y son dos piezas del propio sistema:

- **Lock Task Mode** para el quiosco. Si la app es *Device Owner* del
  teléfono, entra en modo bloqueo sin avisos y sin forma de salir: es lo que
  usan los TPV y los móviles de empresa.
- **AlarmManager** con un *full-screen intent* para que salte sola cada X
  minutos.

Las pegas, por delante:

- Ser Device Owner exige provisionar la app en un móvil **sin ninguna cuenta
  configurada**, es decir, recién restaurado de fábrica. Se hace por `adb` en
  un minuto, pero hay que resetear el teléfono.
- Hay que sacar la app de la optimización de batería o Doze retrasará las
  alarmas.
- Como en el escritorio, tiene que haber una salida de emergencia.

Eso ya no es una PWA: es una app nativa en Kotlin. Reaprovecharía `datos/`
tal cual (el JSON y los PNG) y la lógica de esta versión, que está en
`app.js` y son unas 500 líneas bien delimitadas.

El entorno del ordenador **hoy no puede compilarla**: Android Studio es
anterior a 2021, el SDK está en la API 29 y no hay ningún JDK con `javac`.
Haría falta actualizar Android Studio y bajar JDK 17+ y la plataforma 34 o 35.

---

## Ficheros

```
movil/
├── index.html              estructura de las pantallas
├── app.css                 estilos, pensados para móvil
├── app.js                  toda la lógica: tests, banco de fallos, análisis
├── sw.js                   funcionamiento sin conexión
├── manifest.webmanifest    para instalarla en la pantalla de inicio
├── servir.py               servidor local + Abrir en el movil.bat
├── generar_datos.py        construye datos/ desde las preguntas de escritorio
├── generar_iconos.py       construye iconos/
├── datos/                  banco.json + las 123 señales usadas (4,7 MB)
└── iconos/
```
