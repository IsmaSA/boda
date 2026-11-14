# Formulario de asistencia: Google Sheets + Apps Script

GitHub Pages solo sirve archivos estáticos, así que las respuestas se guardan en una **hoja de cálculo privada de Google** a través de un pequeño script de **Google Apps Script** (gratis, sin servidor que mantener).

```
Invitado ──(formulario en GitHub Pages)──POST──▶ Apps Script (se ejecuta como vosotros) ──▶ Hoja privada «Respuestas»
```

## Por qué esta opción

| Opción | Pros | Contras |
|---|---|---|
| **Google Sheets + Apps Script** (elegida) | Gratis, sin cuentas nuevas, la hoja es vuestra base de datos y panel, exportación a Excel/CSV en un clic | El endpoint es público (inherente a cualquier formulario público); Apps Script no expone la IP del visitante, así que el límite de envíos es global |
| Formspree / Tally / Google Forms | Muy simple | Datos en un tercero; diseño o validación menos controlables; los planes gratuitos tienen límites |
| Supabase / Firebase | Base de datos real, reglas de acceso | Más piezas, claves y mantenimiento para un uso de unas pocas semanas |

Para una boda (cientos de respuestas como mucho) Apps Script es lo más sencillo que cumple los requisitos.

## Puesta en marcha (unos 15 minutos)

1. **Crear la hoja.** En Google Drive, *Nuevo → Hoja de cálculo de Google*. Llamadla p. ej. «Boda – Respuestas». **No la compartáis con nadie** salvo entre vosotros dos.
2. **Pegar el script.** En la hoja: *Extensiones → Apps Script*. Borrad el contenido de `Código.gs` y pegad entero `apps-script/Code.gs` de este repositorio. Guardad (icono de disquete).
3. **Preparar las hojas.** En el desplegable de funciones elegid `setup` y pulsad *Ejecutar*. Google pedirá permiso:
   - «Google no ha verificado esta aplicación» aparece porque el script es vuestro y no está publicado. Pulsad *Configuración avanzada → Ir a … (no seguro)* y *Permitir*.
   - Se crean las pestañas **Resumen**, **Respuestas** e **Historial**.
4. **Ajustes (opcional).** En Apps Script: ⚙️ *Configuración del proyecto → Propiedades del script → Añadir propiedad*:

   | Propiedad | Valor de ejemplo | Para qué |
   |---|---|---|
   | `RSVP_DEADLINE` | `2027-07-31` | Último día para responder (incluido). Vacío = sin límite |
   | `MAX_PARTY` | `50` | Máximo de personas por respuesta (invitado + pareja + acompañantes) |
   | `ALLOW_COMPANIONS` | `true` | Permitir acompañantes |
   | `ALLOW_CHILDREN` | `false` | Permitir marcar niños |
   | `ALLOW_UPDATES` | `true` | Permitir modificar con el enlace privado |
   | `RATE_10MIN` / `RATE_DAY` | `40` / `400` | Freno anti‑abuso global |
   | `PURGE_DATE` | `2027-10-15` | Fecha para el borrado automático de alergias/accesibilidad |
   | `NOTIFY_EMAIL` | `vuestro@gmail.com` | **Recomendado.** Copia por correo de cada respuesta nueva o modificada |

   **Deben coincidir con `rsvp` en `site/config.js`.** El servidor manda: aunque alguien manipule la web, el script aplica estas reglas.
5. **Publicar el script.** *Implementar → Nueva implementación → ⚙️ Aplicación web*:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario** (los invitados no necesitan cuenta de Google)
   - *Implementar* y copiad la **URL de la aplicación web** (termina en `/exec`).
6. **Conectar la web.** Pegad la URL en `site/config.js → rsvp.endpoint`, commit y push.
7. **Probar en producción.** Abrid la web publicada, enviad una respuesta de prueba y comprobad que aparece en *Respuestas*. Probad también el enlace privado de modificación. Después borrad la fila de prueba.

> **Cambios en el script:** tras editar `Code.gs`, usad *Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión*. Así la URL `/exec` no cambia. Una «Nueva implementación» crea otra URL distinta.

## Cómo se garantiza que cada respuesta queda registrada

1. **Primero en el dispositivo del invitado.** Antes de enviarla, la web guarda la respuesta en su navegador. Solo la borra cuando el servidor confirma que está en la hoja.
2. **Reenvío automático.** Si no hay conexión, el servidor está ocupado o responde con error, el invitado ve que su respuesta está guardada y se reenviará sola: a los 5 s, 15 s, 30 s, 1 min, 2 min y luego cada 5 min mientras la página esté abierta, en cuanto el navegador recupera la conexión, y la próxima vez que abra la web.
3. **Nunca duplicada.** Cada respuesta lleva un identificador propio (`request_id`). Si el primer envío llegó pero la confirmación se perdió, el reenvío no crea otra fila. Si el invitado corrigió algo entre medias, se guarda la última versión y la anterior pasa a *Historial*.
4. **Comprobada en la hoja.** El script escribe la fila, fuerza el guardado y la **vuelve a leer** antes de contestar «guardada». Si no la encuentra, responde error y el navegador reintenta.
5. **Nada se descarta por sospecha.** Lo que parece de un robot (enviado en menos de 3 s o con el campo oculto relleno) se guarda igualmente con estado «Revisar: posible spam» y no cuenta en el *Resumen* hasta que lo reviséis.
6. **Copia por correo** (si definís `NOTIFY_EMAIL`): cada respuesta nueva o modificada llega también a vuestro email. Si el correo falla (p. ej. límite diario de Gmail, unas 100 al día en cuentas personales), la respuesta se guarda igual.
7. **Historial de versiones de Google Sheets** (*Archivo → Historial de versiones*) permite recuperar la hoja si alguien borra algo por error.

Lo único que no se guarda: respuestas enviadas después de la fecha límite (el formulario ya no se muestra) y las que el servidor rechaza por datos no válidos, en cuyo caso el invitado ve qué corregir.

> Al añadir `NOTIFY_EMAIL`, Google pedirá un permiso nuevo para enviar correo: ejecutad `setup` una vez desde el editor y aceptad, y publicad una *Nueva versión* de la implementación.

## Cómo se comunica la web con el script

- La web envía `POST` con `Content-Type: text/plain` y un cuerpo JSON. Eso la mantiene como «petición simple» de CORS (sin *preflight*), que es lo que admiten las aplicaciones web de Apps Script. Google responde con una redirección a `script.googleusercontent.com`, que el navegador sigue y que permite leer la respuesta.
- La web **solo** muestra «¡Gracias!» cuando el script contesta `{ ok: true }` tras guardar la fila. Si no hay conexión, o el script responde con error, el invitado lo ve y sus datos siguen en el formulario.

## Seguridad: qué está protegido y qué no

**Protegido**
- La hoja nunca se publica. El script no tiene ninguna acción que liste respuestas; `GET` solo devuelve `{ok:true}`.
- Cada invitado recibe un **token secreto** de 64 caracteres hexadecimales (dos UUID aleatorios). En la hoja solo se guarda su **hash SHA‑256**, así que ni siquiera quien vea la hoja puede reconstruir los enlaces. Con un ID de respuesta o un nombre no se puede leer ni modificar nada.
- **Validación en el servidor** de todos los campos: obligatorios, longitudes máximas, número de personas, coherencia acompañantes/total, consentimiento para datos de salud, fecha límite.
- **Inyección de fórmulas** neutralizada (`=`, `+`, `-`, `@` al inicio se guardan como texto).
- **Duplicados:** cada envío lleva un `requestId`; reintentos y dobles clics devuelven el mismo resultado sin crear otra fila. Una segunda respuesta con el mismo nombre **no sobrescribe** la primera: se guarda marcada «Revisar: posible duplicado» para que decidáis vosotros.
- **Anti‑spam:** campo trampa oculto y tiempo mínimo de 3 s (lo sospechoso se guarda marcado, no se tira), límite global de envíos y `LockService` para que dos envíos simultáneos no se pisen.
- El token del enlace privado va en el fragmento `#…` de la URL (no se envía a GitHub en los registros) y la web lo retira de la barra de direcciones al cargar.

**Limitaciones honestas**
- Cualquiera que conozca la URL `/exec` puede enviar respuestas falsas; los frenos anteriores lo dificultan pero no lo impiden. Por eso revisad la hoja antes de cerrar números con el restaurante.
- Apps Script no expone la IP del visitante: el límite de envíos es **global**. Un abuso intenso podría bloquear temporalmente respuestas legítimas (el invitado vería «espera un minuto»).
- Quien tenga el enlace privado de un invitado puede ver y cambiar **esa** respuesta. Se avisa al invitado de que no lo comparta.
- El tiempo mínimo y el campo trampa solo frenan bots sencillos.
- Se ejecuta con vuestra cuenta de Google y dentro de sus cuotas gratuitas, de sobra para el volumen de una boda.

Si en algún momento necesitáis más control (p. ej. invitaciones con código personal por familia), el siguiente paso sería una lista de invitados con códigos únicos validados en el script.

## Gestión de respuestas (sin tocar código)

- **Resumen:** totales de respuestas, personas confirmadas, niños, alergias, accesibilidad y pendientes de revisar. No cuenta las filas «Anulada» ni «Revisar: posible spam».
- **Respuestas:** una fila por respuesta (quien rellena el formulario), con filtros en la cabecera (*Datos → Crear vista de filtro* para filtrar sin afectar al otro). Columnas: `id, recibido, actualizado, nombre, apellidos, asistencia, personas, pareja, acompanantes, ninos, alergias, accesibilidad, comentarios, idioma, estado, consentimiento_salud` (+ dos columnas internas ocultas: `request_id`, `token_hash`; no las editéis). `alergias` resume las de todos: «Lucía Fernández: Sin gluten (celiaquía); Pablo Gómez: Vegano».
- **Personas:** una fila por cada persona que viene (invitado, pareja y cada acompañante), con `id_respuesta, nombre, apellidos, rol, nino, alergias, otra_alergia`. Es la lista para el restaurante: filtrad por alergia y tendréis nombres y apellidos. Cuando alguien modifica su respuesta, sus filas se sustituyen; si cambia a «no asisto», desaparecen. El *Resumen* cuenta aquí cuántas personas hay con cada alergia o dieta.
- **Historial:** la versión anterior de cada respuesta modificada.
- **Corregir una respuesta:** editad directamente la celda. Para anularla, escribid `Anulada` en `estado`: el **Resumen** deja de contarla y queda constancia. También podéis borrar la fila.
- **Exportar:** *Archivo → Descargar → Microsoft Excel (.xlsx)* o *CSV*. Guardad las exportaciones fuera de este repositorio (el `.gitignore` bloquea `.csv` y `.xlsx` por si acaso).
- Menú **Boda** en la hoja (aparece al recargarla): preparar hojas, borrar alergias/accesibilidad, programar el borrado automático.

## Protección de datos (RGPD)

Esto **no es asesoramiento jurídico**; resume lo que el diseño hace y lo que queda en vuestras manos.

- Se recogen solo los datos necesarios. Alergias y accesibilidad pueden ser **datos de salud** (categoría especial, art. 9 RGPD): solo se guardan con un **consentimiento explícito** aparte, y el servidor lo exige.
- Organizar una boda privada puede entrar en la exención de «actividad exclusivamente personal o doméstica» (art. 2.2.c RGPD), pero al recoger datos mediante una web conviene actuar como si el reglamento aplicara. Eso es lo que hacen el aviso de privacidad y el consentimiento.
- Google actúa como proveedor de almacenamiento (vuestra cuenta personal de Google).
- **Decisiones pendientes vuestras:**
  1. Email de contacto para ejercer derechos → `privacy.contactEmail`.
  2. Fecha máxima de conservación → `privacy.retainUntil` (ahora 31/12/2027).
  3. Fecha de borrado de alergias/accesibilidad → propiedad `PURGE_DATE` y menú *Boda → Programar borrado automático*.
  4. Qué datos pasáis al restaurante: solo los del menú, sin nombres si no hace falta.
  5. Quién más tiene acceso a la hoja (idealmente nadie más).
