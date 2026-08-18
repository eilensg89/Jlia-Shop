const SITE_NAME = 'Jlia’s Shop';

function slugify(value='') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function productSlug(product) {
  return `${slugify(product?.nombre || 'producto')}-${slugify(product?.codigo || 'item')}`;
}

function esc(value='') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function absoluteUrl(origin, value='') {
  const raw = String(value || '');
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${origin}/${raw.replace(/^\/+/, '')}`;
}

function promoInfo(product) {
  const promo = product?.promocion || {};
  const regular = Number(product?.precio || 0);
  if (!promo.activa) return { active:false, regular, final:regular, label:'' };

  let final = regular;
  if (promo.tipo === 'precio') {
    const candidate = Number(promo.precioOferta);
    if (Number.isFinite(candidate) && candidate >= 0) final = candidate;
  } else {
    const discount = Number(promo.descuento || 0);
    if (discount > 0 && discount < 100) final = Math.max(0, regular * (1 - discount / 100));
  }

  const label = promo.etiqueta ||
    (promo.tipo === 'porcentaje' && promo.descuento ? `${promo.descuento}% OFF` : 'OFERTA');

  return { active:true, regular, final, label };
}

function replaceMeta(html, product, origin, version) {
  const slug = productSlug(product);
  const canonical = `${origin}/producto/${encodeURIComponent(slug)}`;
  const images = Array.isArray(product.imagenes) ? product.imagenes.filter(Boolean) : [];
  const image = absoluteUrl(origin, images[0] || 'assets/branding/jlias-shop-logo-share.jpg') +
    `?v=${encodeURIComponent(version || '1')}`;

  const promo = promoInfo(product);
  const price = Number(promo.final || product.precio || 0);
  const priceText = `$${Number(price || 0).toFixed(Number(price || 0) % 1 ? 2 : 0)}`;
  const categoryText = [product.categoria, product.subcategoria].filter(Boolean).join(' · ');
  const descriptionBase = String(product.descripcion || '').trim();
  const description = descriptionBase && !/^consulta por whatsapp/i.test(descriptionBase)
    ? `${descriptionBase} ${priceText}`.trim()
    : `${product.nombre}${categoryText ? ` · ${categoryText}` : ''}${priceText ? ` · ${priceText}` : ''}. Consulta disponibilidad en Jlia’s Shop.`;

  const title = `${product.nombre} | ${SITE_NAME}`;

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(description)}">`)
    .replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="product">`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${esc(product.nombre)}">`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${esc(image)}">`)
    .replace(/<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${esc(image)}">`)
    .replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${esc(canonical)}">`);

  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${esc(canonical)}">`);
  } else {
    html = html.replace('</head>', `  <link rel="canonical" href="${esc(canonical)}">\n</head>`);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.nombre,
    "sku": product.codigo,
    "image": images.map(src => absoluteUrl(origin, src)),
    "description": description,
    "category": product.categoria || undefined,
    "offers": {
      "@type": "Offer",
      "url": canonical,
      "priceCurrency": "USD",
      "price": Number(price || 0).toFixed(2),
      "availability": product.estado === 'Activo'
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
    }
  };

  html = html.replace(
    '</head>',
    `  <meta property="product:price:amount" content="${esc(Number(price || 0).toFixed(2))}">\n` +
    `  <meta property="product:price:currency" content="USD">\n` +
    `  <meta name="twitter:title" content="${esc(product.nombre)}">\n` +
    `  <meta name="twitter:description" content="${esc(description)}">\n` +
    `  <script type="application/ld+json">${jsonForHtml(structuredData)}</script>\n</head>`
  );

  return html;
}

module.exports = async (req, res) => {
  try {
    const slug = String(req.query?.slug || '').toLowerCase();
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = `${proto}://${host}`;

    const [homeResponse, productsResponse] = await Promise.all([
      fetch(`${origin}/`, { headers: { 'User-Agent': 'Jlia-Product-Page/1.0' } }),
      fetch(`${origin}/data/productos.json?social=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Jlia-Product-Page/1.0' }
      })
    ]);

    if (!homeResponse.ok) throw new Error(`No se pudo cargar index.html (${homeResponse.status})`);
    if (!productsResponse.ok) throw new Error(`No se pudo cargar productos.json (${productsResponse.status})`);

    let html = await homeResponse.text();
    const data = await productsResponse.json();
    const products = Array.isArray(data) ? data : (data.productos || []);
    const version = data?._meta?.updatedAt || '1';

    const product = products.find(p => {
      const current = productSlug(p);
      return current === slug || slug.endsWith(`-${slugify(p.codigo)}`);
    });

    if (!product) {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      return res.end();
    }

    html = replaceMeta(html, product, origin, version);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.end(html);
  } catch (error) {
    console.error('PRODUCT PAGE ERROR', error);
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
};
