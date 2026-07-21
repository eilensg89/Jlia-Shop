# Jlias Shop V3 Boutique

Versión boutique del catálogo.

## Mejoras principales
- Conserva el diseño, banners, categorías, WhatsApp y mascota.
- Logo redondo en la barra y en la vista previa de WhatsApp.
- Logo de letras en el footer.
- Todos los productos oficiales y todas sus fotografías.
- Conjuntos organizados por Casual, Falda, Short, Legging, Pantalón y 3 piezas.
- Carteras ampliadas con Sets, Monederos y Billeteras.
- Gafas con sus 3 imágenes y Visera Regular con sus 2 imágenes.
- Botón visible para volver a categorías.
- Botón flotante para subir rápidamente.
- Contador de fotografías en cada producto y galería.
- Navegación Inicio, Categorías y Catálogo siempre visible en móvil.

## Publicación
Descomprime el ZIP y reemplaza el contenido del repositorio actual de GitHub. Vercel detectará el cambio automáticamente.


## Ajuste V3.1
- La página inicial ya no despliega todo el catálogo.
- El buscador se movió arriba de las categorías.
- El catálogo solo aparece cuando el visitante entra a una categoría, busca un producto o toca “Ver todo”.
- La sección de destacados se redujo a 4 productos.
- La navegación interna del catálogo conserva “Todos”, categorías y subcategorías.


## Corrección definitiva V3.2
- Categorías y cuatro destacados quedan escritos también en el HTML como respaldo.
- Los datos completos están integrados en JavaScript; ya no dependen de cargar archivos JSON mediante fetch.
- La mascota y su pop-up aparecen desde la primera carga.
- CSS y JavaScript incluyen versión para evitar caché antigua de Vercel o Safari.
- Se mantiene la portada corta y el catálogo completo solo se abre al buscar, entrar a una categoría o pulsar “Ver todo”.
