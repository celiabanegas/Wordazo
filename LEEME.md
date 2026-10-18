# Wordazo

App para aprender vocabulario de idiomas jugando. Funciona como web instalable (se añade a la pantalla de inicio o al escritorio) y, con el mismo código, como app para iPhone y Android.
Hecha con React Native (Expo) y Supabase.

## Qué incluye

- **Cuentas:** entrar con Google o con email. La contraseña se escribe dos veces y debe tener al menos 10 caracteres, una mayúscula y un número. Recuperación de contraseña por email.
- **Menores de 14 años:** la cuenta no se activa hasta que la madre, el padre o el tutor da su permiso desde un email.
- **Idiomas:** inglés, francés, alemán, italiano, portugués y español culto. Cada idioma con sus palabras y su progreso. Nivel ajustable.
- **Palabras:** sugerencias mientras escribes (corrige erratas), traducción automática con 3 ejemplos traducidos, avisos de falsos amigos, pronunciación con la voz del dispositivo.
- **Personalización:** al empezar (y en Yo → Ajustes) se pregunta, de forma opcional, para qué quiere aprender, a qué se dedica (sector y puesto si trabaja; no se pregunta a menores de 16) y qué temas le gustan. «Para ti» usa esos datos desde el primer día y aparece el tema «Mi trabajo».
- **Palabras:** dos pestañas, «Añadir» y «Mis palabras». En «Añadir» hay un único bloque de sugerencias: «Para ti» (9 a la semana, según tus palabras, a partir de 3 guardadas) o por tema (series, viajes, redes…), de 6 en 6.
- **Juegos:** Elige (todas las palabras de tu banco en cada ronda, 3 vidas, reloj, combos ×4, opciones pensadas para confundir, botón «No la sé · Pasar»), repaso de lo que te cuesta, Tarjetas y Escribe.
- **Amigos:** liga semanal y retos de 24 h por enlace (WhatsApp, Instagram…). Sin chat. Solo se ve el nombre de pila y la inicial.
- **Yo:** calendario del mes, progreso en una frase, pegatinas y ajustes (objetivo diario, aviso diario, privacidad, cerrar sesión, borrar cuenta).
- **Aviso diario:** como mucho uno al día, a la hora elegida, solo si aún no has jugado.

## Panel de Wordazo (solo administradoras)

En Yo → Ajustes → «Panel de Wordazo»: usuarios registrados y activos, altas por día, palabras, uso de la IA, idiomas, niveles, edades e intereses. Solo números totales.
Solo lo ven las cuentas de la tabla `app_admins` (ahora: celiabanegas03@gmail.com y cbbbbanegas@gmail.com). Para añadir otra, en Supabase → SQL:
`insert into app_admins(user_id) select id from auth.users where email = 'correo@ejemplo.com';`

## Cómo se controla el uso de la IA

- **Diccionario compartido:** cada palabra se traduce una sola vez para todos los usuarios.
- **Una sola llamada por palabra:** trae traducción, ejemplos y opciones de los juegos. Los juegos no llaman a Claude.
- **Paquetes de inicio:** se generan una vez por idioma, nivel y tema y se reutilizan.
- **«Para ti»:** una vez por semana y por usuario.
- **Sin límite de palabras guardadas.** El límite diario de 40 está desactivado en la base de datos (disparador `words_daily_limit`); para volver a activarlo: `alter table public.words enable trigger words_daily_limit;`
- **Pronunciación:** usa la voz del dispositivo, sin coste.

## Configuración pendiente (una sola vez)

Todo esto se hace en https://supabase.com/dashboard, proyecto **fichero-palabras**.

1. **Clave de IA** (imprescindible: sin ella no hay traducciones ni sugerencias)
   - **Groq (gratis): ya configurado.** La clave está guardada en la tabla interna `app_secrets` (nombre `groq_api_key`), a la que la app no tiene acceso. Modelo: `openai/gpt-oss-120b`. Para cambiar la clave, lo más sencillo es añadirla en Supabase → *Edge Functions* → *Secrets* como `GROQ_API_KEY`: tiene prioridad sobre la guardada. Límite gratis: unas 1.000 palabras nuevas distintas al día.
   - **Claude (opcional, de pago, mejor calidad):** si algún día añades `ANTHROPIC_API_KEY`, la app pasa a usar Claude automáticamente, sin tocar código.
2. **Dirección de la web** (cuando la subas a Netlify)
   - Supabase → *Authentication* → *URL Configuration*: pon la dirección en **Site URL** y añádela en **Redirect URLs**.
   - En el código, cambia `SITE_URL` en `src/lib/config.ts` y vuelve a compilar.
3. **Contraseñas seguras también en el servidor**
   - *Authentication* → *Sign In / Providers* → *Email*.
   - Mínimo **10** caracteres y *Password requirements*: «Lowercase, uppercase letters and digits».
4. **Entrar con Google**
   - En https://console.cloud.google.com crea unas credenciales *OAuth client ID* (tipo «Web application»).
   - Como *Authorized redirect URI* pon `https://ynnqmnkgcwqgzgrsdkaf.supabase.co/auth/v1/callback`.
   - Copia el Client ID y el Client Secret en Supabase → *Authentication* → *Sign In / Providers* → *Google*.
   - Descarga el logo oficial «G» de la guía de marca de Google (https://developers.google.com/identity/branding-guidelines) y guárdalo como `public/google-g.svg`.
5. **Email de permiso para menores**
   - Crea una cuenta gratuita en https://resend.com y verifica tu dominio.
   - En Supabase → *Edge Functions* → *Secrets* añade `RESEND_API_KEY` y `MAIL_FROM` (por ejemplo `Wordazo <hola@tudominio.com>`).
   - Sin esto, los menores de 14 no pueden activar su cuenta.
6. **Política de privacidad:** completa los datos en amarillo de `public/privacidad.html` y que la revise un abogado.

Los avisos diarios ya están configurados: claves guardadas en la base de datos y tarea programada cada hora.

## Publicar la web

```
npm install
npm run build:web
```
Arrastra la carpeta `dist` a https://app.netlify.com/drop. Para actualizarla, vuelve a compilar y arrastra la carpeta otra vez en *Deploys* de tu sitio.

## Probar como app nativa (opcional)

Instala **Expo Go** en el móvil y ejecuta `npx expo start`. Escanea el código QR. Algunas funciones son solo web por ahora: entrar con Google y avisos.

## Estructura

- `App.tsx` – arranque, comprobaciones de cuenta y pestañas.
- `src/screens/` – pantallas (entrar, registro y permiso, palabras, juegos, amigos, Yo).
- `src/lib/` – datos, idiomas, sugerencias, voz, avisos y reglas de contraseña.
- `public/words/` – listas de palabras para las sugerencias al escribir (una por idioma, se descargan solo al usarlas). Se regeneran con `scripts/build_words.py`.
- `supabase/functions/` – funciones del servidor: `translate`, `starter`, `suggest`, `guardian`, `delete-account`, `daily-reminder`. Ya están desplegadas; aquí está su código para futuros cambios.
- `public/` – icono, archivo de instalación, service worker (caché y avisos) y política de privacidad.
