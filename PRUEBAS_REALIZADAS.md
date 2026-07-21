# Pruebas realizadas — versión 5.0

- Validación de sintaxis de `js/app.js` con Node.
- Validación de los tres JSON.
- Validación de todas las rutas de imágenes declaradas en JSON: sin archivos faltantes.
- Verificación de IDs HTML usados por JavaScript: sin referencias obligatorias inexistentes.
- Catálogo configurado para mostrar los 29 productos.
- Navegación Catálogo y botones “Ver todo” conectados a la apertura del catálogo.
- Categorías convertidas en botones accesibles y conectadas al filtro.
- Buscador conectado a nombre, código, categoría, descripción y palabras clave.
- Carrusel configurado con sus 18 imágenes.
- Mascota configurada con 5 mensajes rotativos.
- Barra de TikTok visible y cerrable.
- Botón flotante verde de WhatsApp eliminado.
- Botón para subir al inicio activado desde 260 px de desplazamiento.

## Corrección crítica
La versión anterior se detenía al iniciar porque JavaScript buscaba un elemento inexistente con ID `groupButton`. Al detenerse la inicialización, no se conectaban catálogo, categorías, buscador, carrusel, mascota ni botón de subir. Esa referencia fue eliminada y la inicialización ahora usa comprobaciones seguras.

## Grupo privado
Se integró la URL oficial de invitación `chat.whatsapp.com` en `data/config.json` y en los enlaces de respaldo del HTML.
