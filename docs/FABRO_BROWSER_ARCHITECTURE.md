# FABRO Browser — Arquitectura Multiplataforma, Seguridad y Guía de Compilación

## 1. Auditoría de Integración con la Plataforma FABRO

FABRO mantiene intacta toda su estructura original (React 19 + Vite + Tailwind CSS + Express + Firebase Auth/Firestore) y todos sus módulos previos (`FABRO IA`, `FABRO CONNECT`, `FABRO HUB`, `FABRO RESEARCH`, `FABRO KNOWLEDGE`, `FABRO DOCUMENTS`, `FABRO DESIGN`, `FABRO STUDY`, `FABRO TOOLS`, `Comunidad`, sistema `Freemium`, autenticación y reglas de Firestore).

- **Separación estricta de cuentas y sesiones**: La autenticación de FABRO (Firebase Auth + Firestore) nunca se mezcla ni comparte cookies con portales externos. Cada perfil de navegador crea un espacio aislado (`persist:fabro_profile_<id>` en Windows y almacenamiento independiente por perfil en Web).
- **Cero lectura automática de chats externos**: `FABRO AI ASSISTANT` y `Comparar IA (Vía API)` trabajan exclusivamente con texto compartido voluntariamente por el estudiante o mediante APIs autorizadas (`FABRO Gateway` / `FABRO CONNECT`).

---

## 2. Evaluación de Motores por Plataforma

### A. FABRO Web (React + Vite — Navegación Selectiva Honesta)
- **Capacidades**: Multi-pestaña, barra Omnibox con búsqueda configurable (Google, DuckDuckGo, Bing, Google Académico) e indicador HTTPS, carpetas de favoritos, historial filtrable por fecha, administrador de descargas con bloqueo de ejecutables peligrosos, visor PDF local integrado (`pdfjs-dist`) con transferencia directa a `FABRO DOCUMENTS`, perfiles aislados y permisos por origen.
- **Regla anti-errores de `iframe`**: Se eliminó cualquier reintento forzado o carga simulada sobre portales que envían `X-Frame-Options: DENY/SAMEORIGIN` o `CSP frame-ancestors`. Si un portal permite incrustación, se muestra como `Modalidad: Integrado`; si bloquea marcos, se abre mediante acción directa del usuario (`target="_blank" rel="noopener noreferrer"`) y pasa explícitamente a estado `Portal abierto externamente`.

### B. FABRO Windows (`desktop-windows/` — Electron + Chromium `WebContentsView`)
- **Por qué `WebContentsView` y no `<webview>` ni `iframe`**: La etiqueta `<webview>` está oficialmente obsoleta en Electron moderno y presenta limitaciones de rendimiento y ciclo de vida. `BaseWindow` + `WebContentsView` permite múltiples pestañas reales en Chromium sin restricciones de `frame-ancestors`, sesiones aisladas por perfil (`session.fromPartition('persist:fabro_profile_<id>')`), control de zoom, búsqueda en página (`findInPage`), impresión (`print`), descarga segura (`will-download`), verificación de certificados TLS (`certificate-error`) y bloqueos por origen.
- **Endurecimiento obligatorio**:
  - `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `nodeIntegrationInSubFrames: false`
  - `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, `allowRunningInsecureContent: false`
  - `preload` mínimo con `contextBridge` habilitado **únicamente** para la interfaz propia de FABRO (nunca inyectado en sitios de terceros).

### C. FABRO Android (`mobile-android/` — Kotlin + Jetpack Compose + `WebView` + Chrome Custom Tabs)
- **Evaluación frente a Capacitor**:
  - **Capacitor** es útil para envolver una SPA simple en un único `WebView`, pero no ofrece pestañas independientes múltiples de forma nativa ni control directo fino de `WebSettings`, `SslErrorHandler`, `PermissionRequest` y `DownloadManager` sin escribir plugins puente propios en Kotlin.
  - **Kotlin + Jetpack Compose + `WebView` endurecido + Chrome Custom Tabs (`androidx.browser`)** brinda control total del ciclo de vida, cumplimiento estricto de políticas OAuth de Google/Microsoft/OpenAI/Anthropic (usando `CustomTabsIntent` claramente etiquetado como pestaña externa y nunca disfrazado de pestaña integrada) y máxima seguridad de red (`usesCleartextTraffic="false"`).
- **Endurecimiento Android**: `allowFileAccess = false`, `allowContentAccess = false`, `allowFileAccessFromFileURLs = false`, `allowUniversalAccessFromFileURLs = false`, `safeBrowsingEnabled = true`, `MIXED_CONTENT_NEVER_ALLOW`, cancelación explícita ante errores SSL (`handler.cancel()`) y diálogo interactivo antes de conceder cámara/micrófono/ubicación.

---

## 3. Matriz Real de Compatibilidad de Portales

Basado en las sondas HTTP reales registradas en `/api/portals/probe`:

| Grupo de Portales | FABRO Web (`iframe`) | FABRO Windows (`WebContentsView`) | FABRO Android (`WebView` / `Custom Tabs`) | Notas de Autenticación / Seguridad |
| :--- | :--- | :--- | :--- | :--- |
| **Académicos y Abiertos** (`Wikipedia`, `CORE`, `BASE`, `OpenAlex`, `Redalyc`, `Internet Archive`, `Project Gutenberg`, `Khan Academy`, `SAIJ`) | **Integrado** (9/42 portales Explorer) | **Integrado nativo** | **WebView integrado** | Cabeceras permisivas sin bloqueo de marco. |
| **Motores y Directorios con bloqueo de marco** (`Google`, `Google Académico`, `SciELO`, `Dialnet`, `arXiv`, `InfoLEG`, `Argentina.gob.ar`) | **Externo directo** (`X-Frame-Options` / `CSP`) | **Integrado nativo** | **WebView integrado** | No se usa proxy ni modificación de CSP. |
| **Plataformas de IA** (`ChatGPT`, `Gemini`, `Claude`, `Copilot`, `Perplexity`, `DeepSeek`, `Grok`, `Meta AI`, `Mistral`, `Poe`) | **Externo directo** (10/10 portales IA) | **Integrado nativo** + fallback a navegador del sistema para OAuth estricto | **Chrome Custom Tabs** | Proveedores como Google, OpenAI, Anthropic y Microsoft exigen contextos de primer nivel / Passkeys / OAuth seguros; no debe forzarse su incrustación en `iframe`. |

---

## 4. Instalación, Pruebas y Generación de Instaladores

### 4.1. FABRO Web (entorno actual Node.js)
```bash
npm install
npm run lint
npm run build
npx tsx src/browser/platformBridge.test.ts
npx tsx server/portals.test.ts
```

### 4.2. FABRO Windows (requiere Windows o entorno con herramientas de compilación Electron)
> **Nota importante**: Este proyecto contiene el código fuente completo, configuración `electron-builder.yml` y pruebas unitarias de seguridad (`tests/security.test.ts`). El paquete `.exe` final debe compilarse en un entorno Windows con Node.js 20+.

```bash
cd desktop-windows
npm install
npm test              # Ejecuta pruebas unitarias de seguridad WebPreferences / URL / descargas
npm run build         # Compila TypeScript a dist/
npm start             # Ejecuta FABRO Browser en modo escritorio local (conecta a FABRO_APP_URL)
npm run package:win   # Genera instalador NSIS (.exe) y versión portable en desktop-windows/release/
```

### 4.3. FABRO Android (requiere Android Studio / Android SDK + JDK 17)
> **Nota importante**: Este proyecto incluye los scripts Gradle KTS, `AndroidManifest.xml`, clases Kotlin endurecidas, interfaz Jetpack Compose y pruebas JUnit4 (`SafeUrlValidatorTest.kt`). La generación de `.apk` / `.aab` debe realizarse con Android SDK instalado fuera de AI Studio.

```bash
cd mobile-android
./gradlew test                  # Ejecuta pruebas unitarias JUnit4
./gradlew assembleDebug         # Genera APK de depuración en app/build/outputs/apk/debug/
./gradlew bundleRelease         # Genera Android App Bundle (.aab) firmado para distribución
```
