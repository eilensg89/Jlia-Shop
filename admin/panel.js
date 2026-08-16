(()=>{
'use strict';

const REPO='eilensg89/Jlia-Shop-CMS-Prueba';
const BRANCH='main';
const API='https://api.github.com';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const clean=s=>(s??'').toString().trim();
const slug=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();
const prefixes={Conjuntos:'CON',Vestidos:'VES',Enterizos:'ENT',Pijamas:'PIJ',Pantalones:'PAN',Blusas:'BLU',Calzado:'CAL',Carteras:'CAR',Accesorios:'ACC'};
const prefixFor=cat=>prefixes[cat]||clean(cat).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase()||'PRD';

const subcategoryExamples={
  Conjuntos:'Ejemplos: 2 piezas, 3 piezas, falda, pantalón, short.',
  Vestidos:'Ejemplos: cortos, largos, tirantes, casuales, fiesta.',
  Enterizos:'Ejemplos: cortos, largos, deportivos, casuales.',
  Pijamas:'Ejemplos: 2 piezas, 3 piezas, short, pantalón.',
  Pantalones:'Ejemplos: largos, jeans, cargo, deportivos.',
  Blusas:'Ejemplos: básicas, manga larga, crop top, deportivas.',
  Calzado:'Ejemplos: tenis, sandalias, tacones, flats.',
  Carteras:'Ejemplos: grandes, pequeñas, crossbody, tote.',
  Accesorios:'Ejemplos: gafas, cinturones, joyería, gorras.'
};
const keywordAliases={
  Conjuntos:['conjunto','conjuntos','set','ropa'],
  Vestidos:['vestido','vestidos','dress'],
  Enterizos:['enterizo','enterizos','jumpsuit'],
  Pijamas:['pijama','pijamas'],
  Pantalones:['pantalón','pantalones','pantalon'],
  Blusas:['blusa','blusas','top','tops'],
  Calzado:['calzado','zapato','zapatos','tenis','sandalias'],
  Carteras:['cartera','carteras','bolso','bolsos'],
  Accesorios:['accesorio','accesorios','gafas','lentes']
};

const state={
  token:null,products:[],categories:[],config:null,activeCategory:null,
  editingProduct:null,editingCategory:null,pendingProductFiles:[],pendingCategoryFile:null,
  productInitialSnapshot:'',imageBlobCache:new Map()
};

function toast(msg,duration=3600){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,duration)}
function setStatus(msg){$('#saveStatus').textContent=msg}
function ghHeaders(){return {Authorization:`Bearer ${state.token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}
async function gh(path,opts={}){const r=await fetch(`${API}${path}`,{...opts,headers:{...ghHeaders(),...(opts.headers||{})}});if(!r.ok){const txt=await r.text();throw new Error(`GitHub ${r.status}: ${txt}`)}return r.status===204?null:r.json()}
function decodeBase64Utf8(b64){const bytes=Uint8Array.from(atob(b64.replace(/\n/g,'')),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
async function loadJson(path){const d=await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}`);return JSON.parse(decodeBase64Utf8(d.content))}

async function loadAll(){
  setStatus('Cargando…');
  const [p,cfg,cats]=await Promise.all([loadJson('data/productos.json'),loadJson('data/config.json'),loadJson('data/categorias.json')]);
  state.products=Array.isArray(p)?p:(p.productos||[]);
  state.categories=(Array.isArray(cats)?cats:(cats.categorias||[])).filter(c=>c.id!=='todos');
  state.config=cfg;
  setStatus('Sin cambios');
  $('#loadingView').hidden=true;
  $('#categoriesSection').hidden=false;
  renderCategories();
  buildStoreForm();
}

function login(){window.open('/api/auth','jlias_oauth','width=700,height=760')}
window.addEventListener('message',e=>{
  if(e.data==='authorizing:github'){e.source?.postMessage('authorizing:github',e.origin);return}
  if(typeof e.data==='string'&&e.data.startsWith('authorization:github:success:')){
    try{const data=JSON.parse(e.data.slice('authorization:github:success:'.length));state.token=data.token;sessionStorage.setItem('jlias_token',state.token);showApp();loadAll().catch(showFatal)}catch(err){showFatal(err)}
  }
  if(typeof e.data==='string'&&e.data.startsWith('authorization:github:error:'))showFatal(new Error('No se pudo iniciar sesión con GitHub.'));
});
function showApp(){state.token=state.token||sessionStorage.getItem('jlias_token');if(!state.token)return;$('#loginView').hidden=true;$('#appView').hidden=false}
function logout(){sessionStorage.removeItem('jlias_token');location.reload()}
function showFatal(err){console.error(err);setStatus('Error');toast(err.message||String(err),5200)}

function repoPathUrl(path){return `/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`}
async function githubBlobUrl(path){
  if(state.imageBlobCache.has(path))return state.imageBlobCache.get(path);
  const promise=(async()=>{
    const r=await fetch(`${API}${repoPathUrl(path)}`,{headers:{...ghHeaders(),Accept:'application/vnd.github.raw+json'}});
    if(!r.ok)throw new Error(`No se pudo cargar ${path}`);
    return URL.createObjectURL(await r.blob());
  })();
  state.imageBlobCache.set(path,promise);
  return promise;
}
function bindRepoImageFallback(img,path){
  if(!img||!path)return;
  img.dataset.repoSrc=path;
  img.addEventListener('error',async function onError(){
    if(img.dataset.repoFallback==='1')return;
    img.dataset.repoFallback='1';
    try{img.src=await githubBlobUrl(path)}catch(e){console.warn(e)}
  },{once:true});
}
function hydrateRepoImages(root=document){root.querySelectorAll('img[data-repo-src]').forEach(img=>bindRepoImageFallback(img,img.dataset.repoSrc))}

function renderCategories(){
  const grid=$('#categoryGrid');
  grid.innerHTML=state.categories.map(c=>{
    const count=state.products.filter(p=>p.categoria===c.id).length;
    return `<article class="category-card-admin" data-cat="${esc(c.id)}"><img src="/${esc(c.imagen)}" data-repo-src="${escAttr(c.imagen)}" alt="${esc(c.nombre)}"><div class="category-copy"><h3>${esc(c.nombre)}</h3><p>${count} producto${count===1?'':'s'}</p></div></article>`
  }).join('')||'<div class="empty">No hay categorías.</div>';
  hydrateRepoImages(grid);
  grid.querySelectorAll('[data-cat]').forEach(el=>el.onclick=()=>openCategory(el.dataset.cat));
}
function openCategory(id){
  state.activeCategory=id;
  const c=state.categories.find(x=>x.id===id);if(!c)return;
  $('#categoryListView').hidden=true;$('#categoryDetailView').hidden=false;
  $('#categoryDetailName').textContent=c.nombre;
  $('#categoryDetailImage').src='/'+c.imagen;$('#categoryDetailImage').dataset.repoFallback='';
  bindRepoImageFallback($('#categoryDetailImage'),c.imagen);
  renderProducts();
}
function renderProducts(){
  const q=clean($('#productSearch').value).toLowerCase();
  let items=state.products.filter(p=>p.categoria===state.activeCategory);
  if(q)items=items.filter(p=>`${p.nombre} ${p.subcategoria||''} ${p.codigo||''}`.toLowerCase().includes(q));
  $('#categoryDetailCount').textContent=`${items.length} producto${items.length===1?'':'s'}`;
  const grid=$('#productGrid');
  grid.innerHTML=items.map(p=>{
    const src=(p.imagenes||[])[0]||'assets/branding/logo.png';
    return `<article class="product-card-admin" data-code="${esc(p.codigo)}"><img class="product-thumb" src="/${esc(src)}" data-repo-src="${escAttr(src)}" alt="${esc(p.nombre)}"><div class="product-copy"><h4>${esc(p.nombre)}</h4><p>$${Number(p.precio||0).toFixed(2)}</p><div class="product-meta"><span>${(p.imagenes||[]).length} foto${(p.imagenes||[]).length===1?'':'s'}</span><span>${esc(p.estado||'Activo')}</span></div></div></article>`
  }).join('')||'<div class="empty">No hay productos en esta categoría.</div>';
  hydrateRepoImages(grid);
  grid.querySelectorAll('[data-code]').forEach(el=>el.onclick=()=>openProduct(el.dataset.code));
}

function nextCode(cat){const pref=prefixFor(cat);let max=0;state.products.forEach(p=>{const m=clean(p.codigo).match(new RegExp(`^${pref}-(\\d+)$`));if(m)max=Math.max(max,+m[1])});return `${pref}-${String(max+1).padStart(3,'0')}`}
function uniqueWords(values){const seen=new Set();const out=[];for(const value of values.flatMap(v=>Array.isArray(v)?v:[v])){const txt=clean(value);if(!txt)continue;for(const raw of txt.split(/[,;|/]+|\s+/)){const w=clean(raw).toLowerCase();if(w.length<2||seen.has(w))continue;seen.add(w);out.push(w)}}return out}
const keywordStopwords=new Set(['con','de','del','la','el','los','las','y','para','por','en','un','una','off']);
function autoStyleFromName(name,category){
  let n=clean(name);if(!n)return '';
  const generic={Conjuntos:/^conjuntos?\s+(deportivo[sa]?\s+)?/i,Vestidos:/^vestidos?\s+(deportivo[sa]?\s+)?/i,Enterizos:/^enterizos?\s+(deportivo[sa]?\s+)?/i,Pijamas:/^pijamas?\s+/i,Pantalones:/^pantalones?\s+/i,Blusas:/^blusas?\s+/i,Calzado:/^(calzado|zapatos?|sandalias?|tenis)\s+/i,Carteras:/^(carteras?|bolsos?)\s+/i,Accesorios:/^accesorios?\s+/i};
  const rx=generic[category];if(rx)n=n.replace(rx,'').trim();
  n=n.replace(/^con\s+/i,'').trim();
  return n||clean(name);
}
function generatedKeywords(){
  const category=state.activeCategory||state.editingProduct?.categoria||'';
  const name=clean($('#pName')?.value||state.editingProduct?.nombre||'');
  const sub=clean($('#pSubcategory')?.value||state.editingProduct?.subcategoria||'');
  const colors=clean($('#pColors')?.value||state.editingProduct?.colores||'');
  const phrases=[category,name,sub,...(keywordAliases[category]||[])];
  const words=uniqueWords([name,sub,colors,...(keywordAliases[category]||[])]).filter(w=>!keywordStopwords.has(w)&&!/^\d+%?$/.test(w));
  const exact=[...new Set(phrases.map(x=>clean(x).toLowerCase()).filter(Boolean))].filter(x=>!/^\d+%?\s*off$/i.test(x));
  return [...exact,...words].filter((x,i,a)=>a.indexOf(x)===i).slice(0,24);
}
function updateProductHelpers(){
  const help=$('#pSubcategoryHelp');if(help)help.textContent=`${subcategoryExamples[state.activeCategory]||'Ejemplo: usa una etiqueta corta que identifique el estilo o modelo.'} Esta etiqueta aparece sobre el nombre del producto.`;
  const suggestions=generatedKeywords();
  const box=$('#keywordSuggestions');
  if(box)box.innerHTML=suggestions.slice(0,12).map(k=>`<span>${esc(k)}</span>`).join('');
}
function useKeywordSuggestions(){
  const manual=$('#pKeywords').value.split(',').map(clean).filter(Boolean);
  $('#pKeywords').value=[...new Set([...manual,...generatedKeywords()])].join(', ');
  updateProductHelpers();
}
function productFormSnapshot(){
  return JSON.stringify({
    name:clean($('#pName').value),price:clean($('#pPrice').value),sub:clean($('#pSubcategory').value),colors:clean($('#pColors').value),
    description:clean($('#pDescription').value),status:$('#pStatus').value,featured:$('#pFeatured').checked,keywords:clean($('#pKeywords').value),promoActive:$('#pPromoActive')?.checked||false,promoType:$('#pPromoType')?.value||'porcentaje',promoPercent:clean($('#pPromoPercent')?.value||''),promoPrice:clean($('#pPromoPrice')?.value||''),promoLabel:clean($('#pPromoLabel')?.value||''),
    images:[...(state.editingProduct?.imagenes||[])],pending:state.pendingProductFiles.map(x=>x.file?.name||'file')
  });
}
function isProductDirty(){return productFormSnapshot()!==state.productInitialSnapshot}
function cleanupPendingProductFiles(){for(const x of state.pendingProductFiles){if(x.preview?.startsWith('blob:'))URL.revokeObjectURL(x.preview)}state.pendingProductFiles=[]}
function closeProductDialog(force=false){
  if(!force&&isProductDirty()&&!confirm('Hay cambios sin guardar. ¿Quieres descartarlos y cerrar?'))return false;
  cleanupPendingProductFiles();
  const dialog=$('#productDialog');
  try{if(dialog.open)dialog.close()}catch(e){console.warn('No se pudo cerrar dialog con close()',e)}
  dialog.removeAttribute('open');
  state.editingProduct=null;
  state.productInitialSnapshot='';
  return true;
}
function openProduct(code=null){
  cleanupPendingProductFiles();
  const p=code?state.products.find(x=>x.codigo===code):null;
  state.editingProduct=p?clone(p):{codigo:nextCode(state.activeCategory),carpeta:'',categoria:state.activeCategory,subcategoria:'',nombre:'',precio:'',colores:'Varios',imagenes:[],destacado:false,estado:'Activo',descripcion:'Consulta por WhatsApp la disponibilidad actual de colores, tallas y modelos.',palabrasClave:[],promocion:{activa:false,tipo:'porcentaje',descuento:0,precioOferta:null,etiqueta:''}};
  state.editingProduct.carpeta=state.editingProduct.codigo;
  $('#productDialogTitle').textContent=p?'Editar producto':'Nuevo producto';
  $('#productOriginalCode').value=p?.codigo||'';
  $('#pName').value=state.editingProduct.nombre||'';
  $('#pPrice').value=state.editingProduct.precio??'';
  $('#pSubcategory').value=state.editingProduct.subcategoria||'';
  $('#pColors').value=state.editingProduct.colores||'';
  $('#pDescription').value=state.editingProduct.descripcion||'';
  $('#pStatus').value=state.editingProduct.estado||'Activo';
  $('#pFeatured').checked=!!state.editingProduct.destacado;
  $('#pKeywords').value=(state.editingProduct.palabrasClave||[]).join(', ');
  const promo=state.editingProduct.promocion||{};
  $('#pPromoActive').checked=promo.activa===true;
  $('#pPromoType').value=promo.tipo||'porcentaje';
  $('#pPromoPercent').value=promo.descuento||'';
  $('#pPromoPrice').value=promo.precioOferta??'';
  $('#pPromoLabel').value=promo.etiqueta||'';
  updatePromoUI();
  $('#deleteProductBtn').hidden=!p;
  renderProductImages();updateProductHelpers();
  $('#productDialog').showModal();
  state.productInitialSnapshot=productFormSnapshot();
}
function promoFinalPrice(base,promo){
  const price=Number(base||0);if(!promo?.activa)return price;
  if(promo.tipo==='precio'){const x=Number(promo.precioOferta);return Number.isFinite(x)&&x>=0?x:price}
  const d=Number(promo.descuento||0);return d>0&&d<100?Math.max(0,price*(1-d/100)):price;
}
function updatePromoUI(){
  const active=$('#pPromoActive')?.checked===true;const wrap=$('#promoFields');if(wrap)wrap.hidden=!active;
  const type=$('#pPromoType')?.value||'porcentaje';
  if($('#promoPercentField'))$('#promoPercentField').hidden=type!=='porcentaje';
  if($('#promoPriceField'))$('#promoPriceField').hidden=type!=='precio';
  const base=Number($('#pPrice')?.value||0);const promo={activa:active,tipo:type,descuento:Number($('#pPromoPercent')?.value||0),precioOferta:Number($('#pPromoPrice')?.value||0)};
  let label=clean($('#pPromoLabel')?.value||'');if(!label&&active){label=type==='porcentaje'&&promo.descuento?`${promo.descuento}% OFF`:'OFERTA'}
  if($('#promoPreviewText'))$('#promoPreviewText').textContent=label||'Oferta activa';
  if($('#promoPreviewPrice'))$('#promoPreviewPrice').textContent=active&&base?`$${base.toFixed(2)} → $${promoFinalPrice(base,promo).toFixed(2)}`:'';
}
function renderProductImages(){
  const existing=(state.editingProduct.imagenes||[]).map(path=>({src:'/'+path,path,repo:true}));
  const pending=state.pendingProductFiles.map(x=>({src:x.preview,path:'',repo:false}));
  const all=[...existing,...pending];
  const gallery=$('#productImages');
  gallery.innerHTML=all.map((item,i)=>`<div class="image-item"><img src="${escAttr(item.src)}" ${item.repo?`data-repo-src="${escAttr(item.path)}"`:''} alt="Imagen ${i+1}"><div class="image-controls"><button type="button" data-left="${i}" ${i===0?'disabled':''}>←</button><button type="button" data-remove="${i}">Quitar</button><button type="button" data-right="${i}" ${i===all.length-1?'disabled':''}>→</button></div></div>`).join('')||'<div class="empty">Todavía no hay imágenes. Puedes guardar el producto y agregarlas después, o pulsar “Agregar imágenes”.</div>';
  hydrateRepoImages(gallery);
  gallery.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>removeImage(+b.dataset.remove));
  gallery.querySelectorAll('[data-left]').forEach(b=>b.onclick=()=>moveImage(+b.dataset.left,-1));
  gallery.querySelectorAll('[data-right]').forEach(b=>b.onclick=()=>moveImage(+b.dataset.right,1));
}
function unifiedImages(){return [...(state.editingProduct.imagenes||[]).map(path=>({kind:'existing',path})),...state.pendingProductFiles.map(x=>({kind:'pending',...x}))]}
function setUnifiedImages(arr){state.editingProduct.imagenes=arr.filter(x=>x.kind==='existing').map(x=>x.path);state.pendingProductFiles=arr.filter(x=>x.kind==='pending').map(({file,preview})=>({file,preview}));renderProductImages()}
function removeImage(i){const arr=unifiedImages();const [r]=arr.splice(i,1);if(r?.kind==='pending'&&r.preview?.startsWith('blob:'))URL.revokeObjectURL(r.preview);setUnifiedImages(arr)}
function moveImage(i,d){const arr=unifiedImages();const j=i+d;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];setUnifiedImages(arr)}

async function fileToBase64(file){const buf=await file.arrayBuffer();let binary='';const bytes=new Uint8Array(buf);const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
async function triggerDeploy(){const r=await fetch('/api/deploy',{method:'POST',headers:{Authorization:`Bearer ${state.token}`}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`No se pudo iniciar la publicación en Vercel (${r.status}).`);return data}
async function gitCommit(files,message){
  setStatus('Guardando en GitHub…');
  const ref=await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);const parent=ref.object.sha;
  const commit=await gh(`/repos/${REPO}/git/commits/${parent}`);const entries=[];
  for(const f of files){
    const blob=await gh(`/repos/${REPO}/git/blobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:f.base64?f.content:btoa(unescape(encodeURIComponent(f.content))),encoding:'base64'})});
    entries.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  const tree=await gh(`/repos/${REPO}/git/trees`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree:entries})});
  const newCommit=await gh(`/repos/${REPO}/git/commits`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,tree:tree.sha,parents:[parent]})});
  await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:newCommit.sha,force:false})});
  setStatus('Guardado en GitHub');
  return newCommit.sha;
}
async function publishInBackground(){
  setStatus('Publicando en Vercel…');
  try{await triggerDeploy();setStatus('Guardado · Vercel actualizando');toast('Cambios guardados. Vercel está actualizando la tienda.',4200)}
  catch(e){console.error(e);setStatus('Guardado · publicación pendiente');toast(`Los cambios se guardaron en GitHub, pero Vercel no pudo iniciarse: ${e.message}`,6500)}
}
function setSaveBusy(busy){
  state.productSaving=busy;
  const b=$('#saveProductBtn');
  b.disabled=busy||state.productDeleting;
  b.textContent=busy?'Guardando…':'Guardar producto';
  $('#deleteProductBtn').disabled=busy||state.productDeleting;
}
function setDeleteBusy(busy){
  state.productDeleting=busy;
  $('#deleteProductBtn').disabled=busy||state.productSaving;
  $('#deleteProductBtn').textContent=busy?'Eliminando…':'Eliminar producto';
  $('#saveProductBtn').disabled=busy||state.productSaving;
}
async function saveProduct(){
  if(state.productSaving||state.productDeleting)return;
  setSaveBusy(true);
  const previousProducts=clone(state.products);
  try{
    const p=state.editingProduct;
    if(!p)throw new Error('No hay un producto abierto para guardar.');
    p.nombre=clean($('#pName').value);
    const rawPrice=clean($('#pPrice').value);
    if(!p.nombre)throw new Error('Escribe el nombre del producto.');
    if(rawPrice==='')throw new Error('Escribe el precio del producto.');
    p.precio=Number(rawPrice);if(!Number.isFinite(p.precio)||p.precio<0)throw new Error('El precio no es válido.');
    const typedStyle=clean($('#pSubcategory').value);const isNewProduct=!clean($('#productOriginalCode').value);p.subcategoria=typedStyle||(isNewProduct?autoStyleFromName(p.nombre,state.activeCategory):clean(p.subcategoria));
    p.colores=clean($('#pColors').value)||'Varios';
    p.descripcion=clean($('#pDescription').value)||'Consulta por WhatsApp la disponibilidad actual de colores, tallas y modelos.';
    p.estado=$('#pStatus').value;
    p.destacado=$('#pFeatured').checked;
    const promoActive=$('#pPromoActive').checked;const promoType=$('#pPromoType').value;const promoPercent=Number($('#pPromoPercent').value||0);const promoPriceRaw=clean($('#pPromoPrice').value);const promoPrice=promoPriceRaw===''?null:Number(promoPriceRaw);
    if(promoActive&&promoType==='porcentaje'&&(!(promoPercent>0)||promoPercent>=100))throw new Error('Escribe un porcentaje de descuento entre 1 y 99.');
    if(promoActive&&promoType==='precio'&&(!Number.isFinite(promoPrice)||promoPrice<0))throw new Error('Escribe un precio de oferta válido.');
    let promoLabel=clean($('#pPromoLabel').value);if(promoActive&&!promoLabel)promoLabel=promoType==='porcentaje'?`${promoPercent}% OFF`:'OFERTA';
    p.promocion={activa:promoActive,tipo:promoType,descuento:promoType==='porcentaje'?promoPercent:0,precioOferta:promoType==='precio'?promoPrice:null,etiqueta:promoLabel};
    const manual=$('#pKeywords').value.split(',').map(clean).filter(Boolean);
    p.palabrasClave=[...new Set([...manual,...generatedKeywords()])];
    p.categoria=state.activeCategory;
    p.codigo=p.codigo||nextCode(p.categoria);p.carpeta=p.codigo;

    const files=[];const uploaded=[];const stamp=Date.now();
    for(let i=0;i<state.pendingProductFiles.length;i++){
      const item=state.pendingProductFiles[i];
      const ext=(item.file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      if(!['jpg','jpeg','png','webp','gif'].includes(ext))throw new Error(`La imagen ${item.file.name} usa un formato no compatible. Usa JPG, PNG o WEBP.`);
      const path=`assets/productos/uploads/${p.codigo.toLowerCase()}-${stamp}-${i+1}.${ext}`;
      files.push({path,content:await fileToBase64(item.file),base64:true});uploaded.push(path);
    }
    p.imagenes=[...(p.imagenes||[]),...uploaded];

    const original=$('#productOriginalCode').value;
    let idx=original?state.products.findIndex(x=>x.codigo===original):-1;
    if(idx<0)idx=state.products.findIndex(x=>x.codigo===p.codigo);
    if(idx>=0)state.products[idx]=clone(p);else state.products.push(clone(p));

    const publicVersion=String(Date.now());
    files.push({path:'data/productos.json',content:JSON.stringify({_meta:{updatedAt:publicVersion},productos:state.products},null,2)});
    await gitCommit(files,`${original?'Actualizar':'Agregar'} producto ${p.codigo} desde CMS`);

    // Convertir la ficha en existente antes de cerrar evita cualquier duplicado si el navegador reacciona lento.
    $('#productOriginalCode').value=p.codigo;
    state.productInitialSnapshot=productFormSnapshot();
    closeProductDialog(true);
    renderProducts();renderCategories();
    toast('Producto guardado correctamente. La tienda se está publicando.',4200);
    publishInBackground();
  }catch(e){
    state.products=previousProducts;
    showFatal(e);
  }finally{setSaveBusy(false)}
}
async function deleteProduct(){
  if(state.productSaving||state.productDeleting)return;
  const current=state.editingProduct;
  if(!current)return;
  if(!confirm('¿Eliminar este producto del catálogo?'))return;
  setDeleteBusy(true);
  const previous=clone(state.products);
  const code=current.codigo;
  try{
    state.products=state.products.filter(p=>p.codigo!==code);
    const publicVersion=String(Date.now());
    await gitCommit([{path:'data/productos.json',content:JSON.stringify({_meta:{updatedAt:publicVersion},productos:state.products},null,2)}],`Eliminar producto ${code} desde CMS`);
    closeProductDialog(true);
    renderProducts();renderCategories();
    toast('Producto eliminado. La tienda se está publicando.',4200);
    publishInBackground();
  }catch(e){state.products=previous;showFatal(e)}
  finally{setDeleteBusy(false)}
}

function openCategoryDialog(newCat=false){state.pendingCategoryFile=null;const c=newCat?{id:'',nombre:'',imagen:''}:clone(state.categories.find(x=>x.id===state.activeCategory));state.editingCategory=c;$('#categoryDialogTitle').textContent=newCat?'Nueva categoría':'Editar categoría';$('#categoryOriginalId').value=newCat?'':c.id;$('#cName').value=c.nombre||'';$('#cImageInput').value='';renderCategoryPreview();$('#deleteCategoryBtn').hidden=newCat;$('#categoryDialog').showModal()}
function renderCategoryPreview(){const src=state.pendingCategoryFile?.preview||(state.editingCategory.imagen?'/'+state.editingCategory.imagen:'');const box=$('#categoryImagePreview');box.innerHTML=src?`<img src="${escAttr(src)}" ${state.pendingCategoryFile?'':`data-repo-src="${escAttr(state.editingCategory.imagen)}"`}>`:'';hydrateRepoImages(box)}
async function saveCategory(){
  try{
    const oldId=$('#categoryOriginalId').value;const name=clean($('#cName').value);if(!name)throw new Error('Escribe el nombre de la categoría.');
    let c=state.editingCategory;c.nombre=name;c.id=name;const files=[];
    if(state.pendingCategoryFile){const ext=(state.pendingCategoryFile.file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`assets/banners/${slug(name)}-${Date.now()}.${ext}`;files.push({path,content:await fileToBase64(state.pendingCategoryFile.file),base64:true});c.imagen=path}
    if(!c.imagen)throw new Error('Agrega una imagen para la categoría.');
    if(oldId){const idx=state.categories.findIndex(x=>x.id===oldId);state.categories[idx]=clone(c);if(oldId!==c.id)state.products.forEach(p=>{if(p.categoria===oldId)p.categoria=c.id})}
    else{if(state.categories.some(x=>x.id.toLowerCase()===c.id.toLowerCase()))throw new Error('Ya existe una categoría con ese nombre.');state.categories.push(clone(c))}
    const catsWithAll=[{id:'todos',nombre:'Todo',imagen:'assets/banners/principal.webp'},...state.categories];
    files.push({path:'data/categorias.json',content:JSON.stringify({categorias:catsWithAll},null,2)});
    if(oldId&&oldId!==c.id)files.push({path:'data/productos.json',content:JSON.stringify({productos:state.products},null,2)});
    await gitCommit(files,`${oldId?'Actualizar':'Agregar'} categoría ${c.nombre} desde CMS`);
    $('#categoryDialog').close();state.activeCategory=c.id;renderCategories();openCategory(c.id);toast('Categoría guardada. Publicando cambios…');publishInBackground();
  }catch(e){showFatal(e)}
}
async function deleteCategory(){
  const c=state.editingCategory;const count=state.products.filter(p=>p.categoria===c.id).length;
  if(count){toast(`No se puede eliminar: esta categoría tiene ${count} productos.`);return}
  if(!confirm(`¿Eliminar la categoría “${c.nombre}”?`))return;
  const previous=state.categories;state.categories=state.categories.filter(x=>x.id!==c.id);
  try{
    await gitCommit([{path:'data/categorias.json',content:JSON.stringify({categorias:[{id:'todos',nombre:'Todo',imagen:'assets/banners/principal.webp'},...state.categories]},null,2)}],`Eliminar categoría ${c.nombre} desde CMS`);
    $('#categoryDialog').close();$('#categoryDetailView').hidden=true;$('#categoryListView').hidden=false;renderCategories();toast('Categoría eliminada. Publicando cambios…');publishInBackground();
  }catch(e){state.categories=previous;showFatal(e)}
}

function field(label,id,value='',type='text',span=false){return `<label class="field ${span?'span-2':''}">${label}<input id="${id}" type="${type}" value="${escAttr(value)}"></label>`}
function buildStoreForm(){
  const c=state.config;const form=$('#storeForm');
  form.innerHTML=`<h3>Marca</h3>${field('Nombre de la tienda','sBrand',c.marca?.nombre||'', 'text', true)}${field('Lema','sTagline',c.marca?.lema||'', 'text', true)}<h3>Contacto y redes</h3>${field('WhatsApp — solo números con código de país','sWa',c.contacto?.whatsappNumero||'')}${field('WhatsApp visible','sWaVisible',c.contacto?.whatsappVisible||'')}${field('Instagram','sInstagram',c.contacto?.instagram||'')}${field('TikTok','sTiktok',c.contacto?.tiktok||'')}${field('Grupo privado de WhatsApp','sGroup',c.contacto?.grupoWhatsapp||'', 'text', true)}<h3>Anuncio superior</h3>${field('Mensaje','sAdText',c.anuncio?.texto||'', 'text', true)}${field('Texto del botón','sAdButton',c.anuncio?.boton||'')}
  <label class="field">Destino del botón<select id="sAdLink"><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="grupoWhatsapp">Grupo privado de WhatsApp</option><option value="catalogo">Catálogo</option></select></label><label class="check-field"><input id="sAdActive" type="checkbox"> Mostrar anuncio</label><div class="store-actions"><button id="saveStoreBtn" type="button" class="btn btn-primary">Guardar datos de la tienda</button></div>`;
  $('#sAdLink').value=c.anuncio?.enlace||'tiktok';$('#sAdActive').checked=c.anuncio?.activo!==false;$('#saveStoreBtn').onclick=saveStore;
}
async function saveStore(){
  try{
    const c=state.config;c.marca=c.marca||{};c.contacto=c.contacto||{};c.anuncio=c.anuncio||{};
    c.marca.nombre=clean($('#sBrand').value);c.marca.lema=clean($('#sTagline').value);c.contacto.whatsappNumero=clean($('#sWa').value);c.contacto.whatsappVisible=clean($('#sWaVisible').value);c.contacto.instagram=clean($('#sInstagram').value);c.contacto.tiktok=clean($('#sTiktok').value);c.contacto.grupoWhatsapp=clean($('#sGroup').value);c.anuncio.texto=clean($('#sAdText').value);c.anuncio.boton=clean($('#sAdButton').value);c.anuncio.enlace=$('#sAdLink').value;c.anuncio.activo=$('#sAdActive').checked;
    await gitCommit([{path:'data/config.json',content:JSON.stringify(c,null,2)}],'Actualizar datos de la tienda desde CMS');toast('Datos de la tienda guardados. Publicando cambios…');publishInBackground();
  }catch(e){showFatal(e)}
}

function esc(s){return clean(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escAttr(s){return esc(s)}

$('#loginBtn').onclick=login;$('#logoutBtn').onclick=logout;
$('#backCategoriesBtn').onclick=()=>{$('#categoryDetailView').hidden=true;$('#categoryListView').hidden=false;state.activeCategory=null;$('#productSearch').value=''};
$('#addCategoryBtn').onclick=()=>openCategoryDialog(true);$('#editCategoryBtn').onclick=()=>openCategoryDialog(false);$('#addProductBtn').onclick=()=>openProduct();$('#productSearch').oninput=renderProducts;
$('#saveProductBtn').onclick=saveProduct;$('#deleteProductBtn').onclick=deleteProduct;
$('#closeProductBtn').onclick=()=>closeProductDialog(false);$('#cancelProductBtn').onclick=()=>closeProductDialog(false);
$('#productDialog').addEventListener('cancel',e=>{e.preventDefault();closeProductDialog(false)});
['pName','pSubcategory','pColors'].forEach(id=>$('#'+id).addEventListener('input',updateProductHelpers));
['pPrice','pPromoPercent','pPromoPrice','pPromoLabel'].forEach(id=>$('#'+id)?.addEventListener('input',updatePromoUI));
$('#pPromoActive')?.addEventListener('change',updatePromoUI);$('#pPromoType')?.addEventListener('change',updatePromoUI);
$('#pUseKeywordsBtn').onclick=useKeywordSuggestions;
$('#pImagesInput').onchange=e=>{
  for(const file of [...e.target.files]){
    if(!file.type.startsWith('image/')){toast(`${file.name} no parece ser una imagen.`);continue}
    state.pendingProductFiles.push({file,preview:URL.createObjectURL(file)});
  }
  e.target.value='';renderProductImages();
};
$('#cImageInput').onchange=e=>{const file=e.target.files[0];if(file){if(state.pendingCategoryFile?.preview)URL.revokeObjectURL(state.pendingCategoryFile.preview);state.pendingCategoryFile={file,preview:URL.createObjectURL(file)};renderCategoryPreview()}};
$('#saveCategoryBtn').onclick=saveCategory;$('#deleteCategoryBtn').onclick=deleteCategory;
$$('.nav-btn').forEach(b=>b.onclick=()=>{$$('.nav-btn').forEach(x=>x.classList.toggle('active',x===b));$('#categoriesSection').hidden=b.dataset.section!=='categories';$('#storeSection').hidden=b.dataset.section!=='store';if(b.dataset.section==='categories'&&!state.activeCategory){$('#categoryListView').hidden=false;$('#categoryDetailView').hidden=true}});

state.token=sessionStorage.getItem('jlias_token');if(state.token){showApp();loadAll().catch(e=>{sessionStorage.removeItem('jlias_token');showFatal(e);setTimeout(()=>location.reload(),1200)})}
})();
