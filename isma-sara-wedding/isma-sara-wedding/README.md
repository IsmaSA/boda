# Isma & Sara · 18 de septiembre de 2027

Web de la boda en el **Restaurante Casablanca, Villanueva de la Serena (Badajoz)**. Bilingüe (español por defecto, inglés), con cuenta atrás, información práctica, preguntas frecuentes y **confirmación de asistencia** que guarda las respuestas en una hoja de Google privada.

- **Para cambiar textos y datos:** solo `site/config.js`.
- **Para el formulario:** [`docs/RSVP-BACKEND.md`](docs/RSVP-BACKEND.md).
- **Publicación:** automática con GitHub Actions al hacer push a `main`.

---

## 1. Qué hay en el repositorio

```
site/                 La web (lo que se publica)
  config.js           ← TODOS los datos y textos editables
  index.html          Plantilla de la página
  privacidad.html     Aviso de privacidad
  404.html            Página «no encontrada»
  assets/css/         Estilos
  assets/js/          Comportamiento (idioma, cuenta atrás, formulario)
  assets/img/         Ilustración, iconos, vista previa para redes, vuestras fotos
  assets/fonts/       Tipografías alojadas aquí (sin Google Fonts: mejor privacidad)
apps-script/Code.gs   Backend del formulario (se pega en Google Apps Script)
scripts/              Generación de la web, comprobación de config, imágenes
tests/                Pruebas del backend y del navegador
.github/workflows/    Publicación en GitHub Pages
docs/                 Guía del formulario y protección de datos
```

Sin frameworks: HTML, CSS y JavaScript. El paso de *build* solo comprueba `config.js` y pre‑genera la página en español (carga más rápida y funciona aunque falle JavaScript).

## 2. Publicar en GitHub Pages (primera vez)

### Elegir el nombre

GitHub **no admite `&`** en nombres de usuario ni de organización, así que `Isma&Sara.github.io` no es posible. Opciones:

| Tipo | Repositorio | Dirección | Notas |
|---|---|---|---|
| **Sitio de usuario/organización** (recomendado) | `isma-sara.github.io` en la cuenta u organización **`isma-sara`** | `https://isma-sara.github.io/` | La dirección más limpia. Requiere que el nombre `isma-sara` esté libre; podéis crear una **organización gratuita** con ese nombre desde vuestra cuenta |
| Sitio de proyecto | p. ej. `boda` en vuestra cuenta actual | `https://vuestro-usuario.github.io/boda/` | No hace falta cuenta nueva |
| Dominio propio (opcional) | cualquiera de los dos | p. ej. `https://ismaysara.es` | Se compra aparte (~10 €/año) y se configura en *Settings → Pages → Custom domain* |

No he podido comprobar desde aquí si `isma-sara` está libre: abrid `https://github.com/isma-sara`; si da 404, está disponible. Alternativas: `ismaysara`, `isma-y-sara`.

La web funciona con cualquiera de las tres: el flujo de publicación calcula la dirección base automáticamente.

### Pasos

1. Cread la organización/cuenta `isma-sara` (o usad la vuestra) y un repositorio **vacío** llamado `isma-sara.github.io` (o `boda`). Puede ser público o privado (privado requiere plan de pago para Pages).
2. Subid este proyecto:
   ```bash
   git remote add origin https://github.com/isma-sara/isma-sara.github.io.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. En **Actions** veréis «Publicar web». Al terminar (~1 min), la dirección aparece en el resumen del trabajo y en *Settings → Pages*.
5. Si no usáis `isma-sara.github.io`, cambiad `siteUrl` en `site/config.js` por la dirección real (se usa para la vista previa al compartir por WhatsApp).

Cada push a `main` vuelve a publicar. Si `config.js` tiene un error, la publicación se detiene, la web anterior sigue en línea y el registro de Actions dice exactamente qué línea corregir.

## 3. Cambiar datos de la boda

Editad `site/config.js` (en GitHub mismo: abrid el archivo → ✏️ → *Commit changes*). Reglas:

- Cada texto tiene `es` y `en`.
- `null` o `[]` = **no se muestra**. Nada sin confirmar aparece publicado.
- Lo marcado `⚠️ POR CONFIRMAR` son decisiones vuestras.

| Quiero… | Campo |
|---|---|
| Poner la hora de la ceremonia | `wedding.ceremonyTime: '12:30'` (la cuenta atrás pasa a usarla) |
| Añadir código de vestimenta | `details.dressCode: { es: '…', en: '…' }` (aparece también en las preguntas) |
| Publicar el programa | `schedule: [{ time: '12:30', title: { es, en }, description: { es, en } }]` |
| Cambiar hoteles y enlaces de Booking/Airbnb | `stay` (sección «Dónde dormir»; los grupos y sitios se añaden o borran por bloques) |
| Cambiar las curiosidades de Villanueva | `curiosities: [{ q: { es, en }, a: { es, en } }]` |
| Cambiar las rutas desde otras ciudades | `travel.routes` (una entrada por ciudad; `mode`: `car`, `train`, `bus` o `plane`) |
| Activar el formulario | `rsvp.endpoint` (ver `docs/RSVP-BACKEND.md`) |
| Fecha límite | `rsvp.deadline: '2027-07-31'` + propiedad `RSVP_DEADLINE` en el script |
| Más preguntas frecuentes | `faq: [{ q: { es, en }, a: { es, en } }]` |
| Email para privacidad | `privacy.contactEmail` |

**Cuenta atrás:** cuenta hasta la hora de la ceremonia en hora de Madrid; mientras no haya hora, hasta las 00:00 del 18/09/2027. Ese día muestra «¡Hoy es el día!» y después un agradecimiento; nunca valores negativos.

**Dirección y mapa.** La dirección (Avenida de Chile, s/n, 06700, frente al Palacio de Congresos) coincide en Bodas.net y en la ficha de Google Maps del restaurante. Junto a ella hay un mapa de Google Maps (`venue.map`):
- Por defecto el invitado pulsa «Mostrar mapa» para cargarlo, porque Google Maps usa cookies y en España eso requiere consentimiento. El navegador recuerda la elección, así que en visitas posteriores aparece directamente.
- `askFirst: false` lo muestra siempre sin preguntar (el aviso de privacidad se adapta solo).
- Para usar exactamente el mapa que elijáis en Google Maps: *Compartir → Insertar un mapa*, copiad la dirección que va dentro de `src="…"` y pegadla en `venue.map.embedUrl`.
- `map: null` quita el mapa; el botón «Cómo llegar» abre la ficha del restaurante en Google Maps.

## 4. Fotos

La web tiene vuestras fotos: la de la pedida junto al texto de «Nos casamos» y siete más en «Algunos de nuestros momentos». Al pulsar cualquiera se abre en grande (flechas del teclado, botones o deslizando el dedo). La portada sigue siendo la ilustración de la dehesa.

**Añadir o cambiar una foto**

1. Preparadla (corrige la rotación, **borra la ubicación GPS y todos los metadatos** y crea dos tamaños ligeros):
   ```bash
   python3 scripts/process_photos.py ~/Descargas/foto.jpg playa
   # → site/assets/img/fotos/playa-640.webp y playa-1280.webp, e imprime width y height
   ```
2. Añadid un bloque en `config.js → photos.gallery` (el orden de la lista es el orden en la web):
   ```js
   { src: 'assets/img/fotos/playa', width: 1280, height: 960,
     alt: { es: 'Isma y Sara en la playa…', en: 'Isma and Sara on the beach…' } },
   ```
   `alt` describe la foto para quien no puede verla. Opcional: `caption: { es, en }` (pie de foto) y `position: '50% 70%'` (qué parte se ve si se recorta).
3. **Quitar una foto:** borrad su bloque. Si `config.js` menciona una foto que no existe, la publicación se detiene y dice cuál falta.

Para usar una foto vuestra como portada: `photos.hero` con el mismo formato; el texto pasa a claro sobre la imagen. Elegid una foto con una zona tranquila a la izquierda y comprobad en el móvil que se lee bien.

Vista previa para redes (`assets/img/og.png`) e iconos se regeneran con `python3 scripts/make_icons.py`.

El gráfico de temperaturas de «¿Hará calor en septiembre?» sale de `data/clima-villanueva.json` (ERA5 vía Open-Meteo). Para actualizarlo con un año más, añadid sus datos al JSON con la misma consulta que figura en él y ejecutad `python3 scripts/clima.py` (necesita numpy y scipy), que regenera `site/assets/js/clima.js` con la tendencia y los intervalos del 95 %.

## 5. Trabajar en local (opcional)

Requisitos: Node 22+.
```bash
npm start          # genera dist/ y abre http://localhost:8080
npm run check      # solo comprueba config.js
npm run build      # genera dist/
```

Pruebas (requieren además Python 3 con Playwright: `pip install playwright && playwright install chromium`):
```bash
npm install        # axe-core para las pruebas de accesibilidad
npm test           # backend (20 pruebas) + navegador (29 pruebas)
python3 tests/screens.py http://localhost:8080/ screens   # capturas en móvil/tablet/escritorio
```
Las pruebas de navegador usan un **emulador** que ejecuta el `Code.gs` real con una hoja en memoria; no sustituyen la prueba final en producción descrita en `docs/RSVP-BACKEND.md`.

## 6. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Actions falla en «Comprobar config.js» | Error en `config.js`: el registro indica el campo. Suele ser una coma o comilla |
| La web sale sin estilos en un sitio de proyecto | `siteUrl` incorrecto; con Actions se calcula solo, revisad que *Source* sea *GitHub Actions* |
| «El formulario aún no está activo» | `rsvp.endpoint` vacío |
| «No hay conexión con el servidor» en todas las respuestas | URL `/exec` mal copiada, script no implementado como *Cualquier usuario*, o se cambió la implementación sin nueva versión |
| Las respuestas no aparecen | Mirad la pestaña *Respuestas* (no *Hoja 1*); en Apps Script → *Ejecuciones* veréis errores |
| Una respuesta aparece como «Revisar: posible spam» | Se envió en menos de 3 s o con el campo oculto relleno. Si es de verdad, cambiad su estado (p. ej. a `OK`) y ya cuenta en el *Resumen* |
| No llegan los correos de copia | Falta la propiedad `NOTIFY_EMAIL` o el permiso de correo: ejecutad `setup` otra vez en Apps Script y aceptad |
| Cambié una propiedad del script y no se nota | Las propiedades se leen en cada envío; si cambiasteis `Code.gs`, publicad una *Nueva versión* |
| La web aparece en inglés | El navegador está en inglés; el selector ES/EN lo cambia y se recuerda |

## 7. Accesibilidad, rendimiento y privacidad

- HTML semántico, enlace «Saltar al contenido», navegación con teclado, foco visible, mensajes de error asociados a cada campo y anunciados, contraste AA, respeto de «reducir movimiento». Verificado con axe‑core (WCAG 2.1 AA) en español, inglés, errores, éxito y menú móvil.
- Tipografías propias (Fraunces e Instrument Sans, licencia SIL OFL) en `assets/fonts/`; la cursiva solo incluye el «&» (4 KB). Sin peticiones a terceros al cargar la web.
- Sin cookies ni analítica. `noindex`: la web no aparece en buscadores (quitad la etiqueta `robots` de `site/index.html` si queréis lo contrario).

## Créditos

Ver [`docs/CREDITS.md`](docs/CREDITS.md).
