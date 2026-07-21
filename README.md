# Jlia’s Shop — ESG Shop Template JSON

## Subida rápida a GitHub / Vercel

Esta versión conserva los archivos JSON, pero integra las galerías de productos y el carrusel dentro de los JSON para reducir el proyecto a menos de 40 archivos.

### Archivos principales
- `index.html`
- `css/style.css`
- `js/app.js`
- `data/config.json`
- `data/categorias.json`
- `data/productos.json`
- `assets/branding/`
- `assets/banners/`

### Despliegue
1. Descomprime el ZIP.
2. En GitHub, abre **Add file → Upload files**.
3. Arrastra todo el contenido de la carpeta, no la carpeta contenedora.
4. Confirma que `index.html`, `css`, `js`, `data` y `assets` estén en la raíz.
5. En Vercel, conecta el repositorio y usa Framework Preset: **Other**.
6. No configures Build Command ni Output Directory.

### Edición
- Contactos, TikTok, WhatsApp, anuncio y carrusel: `data/config.json`.
- Categorías y sus portadas: `data/categorias.json`.
- Productos, precios, estados, destacados y galerías: `data/productos.json`.

> Las imágenes de las galerías están codificadas dentro del JSON para evitar el límite de 100 archivos del cargador web de GitHub.
