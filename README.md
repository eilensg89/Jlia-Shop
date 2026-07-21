# Jlias Shop — catálogo web

## Publicar
Sube el contenido completo de esta carpeta al directorio público de tu hosting. La página principal es `index.html`.

## Vista local
Los navegadores bloquean la lectura de JSON al abrir `index.html` directamente. En esta carpeta ejecuta:

```bash
python -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Mantenimiento rápido

### Cambiar contactos, barra o mascota
Edita `data/config.json`.

### Agregar un producto
1. Crea una carpeta dentro de `assets/productos/`, por ejemplo `CON-009`.
2. Coloca imágenes optimizadas como `1.webp`, `2.webp`, etc.
3. Duplica un objeto en `data/productos.json` y cambia código, nombre, precio, categoría e imágenes.

### Ocultar un producto
Elimina temporalmente su objeto de `data/productos.json` o cambia su estado y adapta el filtro si deseas conservarlo.

### Cambiar banners o logo
Reemplaza el archivo manteniendo el mismo nombre:
- `assets/branding/logo.webp`
- `assets/branding/mascota.webp`
- `assets/banners/principal.webp`
- `assets/banners/ropa.webp`
- `assets/banners/pijamas.webp`

## Datos oficiales incluidos
- WhatsApp: +1 (239) 367-3388
- Canal de WhatsApp
- Instagram
- TikTok
