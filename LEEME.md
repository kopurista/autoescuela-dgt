# Autoescuela DGT — versión móvil

Una PWA: una web que se guarda en la pantalla de inicio del móvil y funciona
como una app. Misma lógica que la versión de escritorio (los cuatro modos de
test, el banco de fallos y el análisis), el mismo banco de **480 preguntas** y
las **señales oficiales**.

Funciona en Android y en iPhone, y no hace falta instalar nada en el ordenador
para usarla.

**Lo que todavía NO hace: bloquear el móvil.** Es la fase siguiente y solo es
posible en Android. Hay una sección sobre eso al final.

---

## Probarla ahora mismo

1. Doble clic en **`Abrir en el movil.bat`**. Deja la ventana abierta.
2. Verás dos direcciones. Abre en el móvil la que empieza por `http://192.168…`
3. El móvil tiene que estar en **la misma wifi** que el ordenador.

Ya puedes hacer tests. El progreso se guarda en el propio móvil.

### Instalarla en la pantalla de inicio

- **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*. Funciona
  también por wifi.
- **Android (Chrome):** menú ⋮ → *Añadir a pantalla de inicio*.

---

## Para que funcione sin conexión hace falta HTTPS

Esto conviene entenderlo antes de pelearse con ello. El guardado sin conexión
lo hace un *service worker*, y los navegadores solo lo permiten en lo que
llaman un **contexto seguro**: HTTPS, `localhost` o `127.0.0.1`.

`http://192.168.1.81:8765` no es ninguna de las tres. Por wifi, la aplicación
**funciona** pero no se guarda para usarla sin cobertura, y en Android la
instalación queda a medias. El código lo detecta y simplemente no intenta
registrarlo, así que no falla nada: solo depende de que el ordenador esté
encendido y sirviendo.

Para tenerla de verdad en el bolsillo hay dos caminos:

- **Publicarla en un hosting estático gratuito** (GitHub Pages, Netlify,
  Cloudflare Pages). Se sube la carpeta `movil/` entera y ya tienes HTTPS,
  instalación completa y funcionamiento sin conexión. Es lo más cómodo con
  diferencia: el ordenador deja de hacer falta.
- **Un túnel** (`cloudflared`, `ngrok`) que da una URL HTTPS temporal
  apuntando a tu ordenador. Sirve para probar, pero la URL cambia y el
  ordenador tiene que seguir encendido.

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
├── datos/                  banco.json + las 78 señales usadas (3 MB)
└── iconos/
```
