(function(){
  const PREFIXES={
    'Conjuntos':'CON','Vestidos':'VES','Enterizos':'ENT','Pijamas':'PIJ','Pantalones':'PAN',
    'Blusas':'BLU','Calzado':'CAL','Carteras':'CAR','Accesorios':'ACC'
  };
  const clean=s=>(s||'').toString().trim();
  const noAccent=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const prefixFor=cat=>PREFIXES[clean(cat)] || noAccent(cat).replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase() || 'PRD';

  CMS.registerEventListener({
    name:'preSave',
    handler:({entry})=>{
      let data=entry.get('data');

      if(data.get('productos')){
        let productos=data.get('productos');
        const used=new Set();
        const seen=new Set();

        productos.forEach(p=>{
          const c=clean(p.get('codigo'));
          if(c){
            if(seen.has(c)) throw new Error(`Código duplicado: ${c}. Cada producto debe tener un código único.`);
            seen.add(c);
            used.add(c);
          }
        });

        const nextCode=cat=>{
          const pref=prefixFor(cat);
          let max=0;
          used.forEach(c=>{
            const m=c.match(new RegExp('^'+pref+'-(\\d+)$'));
            if(m) max=Math.max(max,Number(m[1]));
          });
          let n=max+1;
          let code;
          do { code=`${pref}-${String(n++).padStart(3,'0')}`; } while(used.has(code));
          used.add(code);
          return code;
        };

        productos=productos.map(p=>{
          const categoria=clean(p.get('categoria'));
          const nombre=clean(p.get('nombre'));
          if(!categoria) throw new Error(`El producto “${nombre||'sin nombre'}” necesita una categoría.`);
          if(!nombre) throw new Error('Todos los productos necesitan un nombre.');

          let codigo=clean(p.get('codigo'));
          if(!codigo) codigo=nextCode(categoria);
          p=p.set('codigo',codigo).set('carpeta',codigo);
          if(!clean(p.get('estado'))) p=p.set('estado','Activo');
          if(!clean(p.get('colores'))) p=p.set('colores','Varios');
          if(!clean(p.get('descripcion'))) p=p.set('descripcion','Consulta por WhatsApp la disponibilidad actual de colores, tallas y modelos.');
          return p;
        });
        return data.set('productos',productos);
      }

      if(data.get('categorias')){
        let categorias=data.get('categorias');
        const nombres=new Set();
        categorias=categorias.map(c=>{
          const nombre=clean(c.get('nombre'));
          if(!nombre) throw new Error('Todas las categorías necesitan un nombre.');
          const key=noAccent(nombre).toLowerCase();
          if(nombres.has(key)) throw new Error(`Categoría duplicada: ${nombre}.`);
          nombres.add(key);
          const id=key==='todo' || key==='todos' ? 'todos' : nombre;
          return c.set('id',id);
        });

        // El filtro general "Todo" es estructural. Si se elimina accidentalmente, se restaura.
        if(!categorias.some(c=>c.get('id')==='todos')){
          const Map=window.Immutable && window.Immutable.Map;
          if(Map){
            categorias=categorias.unshift(Map({id:'todos',nombre:'Todo',imagen:'assets/banners/principal.webp'}));
          }
        }
        return data.set('categorias',categorias);
      }

      return data;
    }
  });
})();
