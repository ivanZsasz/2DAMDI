# Guía para convertir VELUT en App Móvil (APK)

Esta guía te explíca paso a paso cómo subir tu web a internet y convertirla en una aplicación instalable (APK) para Android.

## Paso 1: Convertir en PWA (Ya realizado) ✅

El proyecto ya está configurado como una PWA (Progressive Web App):
- Tiene un archivo `manifest.json` con el nombre, colores e iconos.
- Tiene un `service-worker.js` registrado para funcionar offline y ser instalable.

## Paso 2: Subir a Internet (Firebase Hosting) 🚀

Necesitas que tu proyecto esté en una URL pública (ej: `https://velut-app.web.app`) para poder generar la APK.

### Requisitos previos
1.  Tener **Node.js** instalado.
2.  Tener una cuenta de Google/Firebase.

### Pasos
1.  **Instalar herramientas de Firebase** (si no las tienes):
    ```bash
    npm install -g firebase-tools
    ```
2.  **Iniciar sesión**:
    ```bash
    firebase login
    ```
3.  **Inicializar proyecto** (solo si no está conectado):
    ```bash
    firebase init hosting
    ```
    - Selecciona "Use an existing project" (tu proyecto de Firestore).
    - Public directory: `.` (punto, carpeta actual) o simplemente dale a Enter si detecta la raíz.
    - Configure as a single-page app? **Yes**.
    - Set up automatic builds and deploys with GitHub? **No** (por ahora).
    - File `index.html` already exists. Overwrite? **NO**.
4.  **Desplegar**:
    ```bash
    firebase deploy
    ```

¡Listo! Al finalizar te dará una URL (ej: `https://tu-proyecto.web.app`). **Copia esa URL**.

---

## Paso 3: Generar el APK (Android) 📱

Usaremos **PWABuilder**, una herramienta gratuita de Microsoft para empaquetar PWAs.

1.  Ve a **[PWABuilder.com](https://www.pwabuilder.com/)**.
2.  Pega la URL de tu web (la que obtuviste en el paso anterior) y pulsa **Start**.
3.  Si todo está correcto (verás "Manifest OK", "Service Worker OK", "Security OK"), pulsa el botón **Package for Stores** (a veces dice "Build My PWA").
4.  Selecciona **Android**.
5.  Pulsa **Generate**.
6.  Te pedirá algunos datos (Package ID, App Name, etc.). Puedes dejar los valores por defecto o personalizarlos.
    - **Signing Key**: Selecciona "No, create one for me" si es para pruebas o uso personal.
7.  Descarga el archivo ZIP.
8.  Dentro del ZIP, busca el archivo `.apk` (normalmente en `android/app/build/outputs/apk/debug/app-debug.apk` o similar, o directamente te ofrece el APK firmado).
9.  Envíate ese archivo APK al móvil e instálalo.

¡Enhorabuena! Tienes VELUT instalada como una app nativa. 🎉
