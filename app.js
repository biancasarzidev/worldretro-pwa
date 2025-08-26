// World Retro PWA Prototype - Cart, Catalog, Checkout (refinado)
const LS = {
  cart: 'wr_cart',
  orders: 'wr_orders',
  ui: 'wr_ui'
};

const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem(LS.cart) || '[]'),
  freight: { value: 0, label: '' },
  orders: JSON.parse(localStorage.getItem(LS.orders) || '[]'),
  ui: JSON.parse(localStorage.getItem(LS.ui) || '{"q":"","console":"","sort":"relevance"}')
};

const $ = (id) => document.getElementById(id);
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function saveCart(){ localStorage.setItem(LS.cart, JSON.stringify(state.cart)); updateCartCount(); }
function saveOrders(){ localStorage.setItem(LS.orders, JSON.stringify(state.orders)); }
function saveUI(){ localStorage.setItem(LS.ui, JSON.stringify(state.ui)); }

function updateCartCount(){
  const n = state.cart.reduce((s,i)=>s + (i.qtd||0), 0);
  const el = $('cartCount');
  if (el) el.textContent = n;
}

function route(viewId){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const view = $(viewId);
  if (view) view.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- FRETE (regra simples) ---------- */
// Base: R$22,90 + R$5 por item adicional. Grátis >= R$300.
function calcFrete(cep){
  const total = state.cart.reduce((s,i)=>s+i.price*i.qtd,0);
  if(total >= 300){
    state.freight = { value: 0, label: 'Frete grátis (pedidos acima de R$ 300,00)' };
    return;
  }
  const qty = state.cart.reduce((s,i)=>s+i.qtd,0);
  const val = 22.90 + Math.max(0, qty-1)*5;
  const label = `Padrão (${(cep||'').trim() || 'CEP não informado'})`;
  state.freight = { value: Number(val.toFixed(2)), label };
}

/* ---------- PRODUCTS ---------- */
async function loadProducts(){
  try {
    // O SW já faz network-first p/ products.json; aqui só tratamos erros.
    const res = await fetch('./products.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.products = await res.json();
  } catch (err) {
    console.error('Falha ao carregar products.json', err);
    state.products = state.products || [];
    // aviso suave no topo do catálogo
    showCatalogNotice('Você está offline ou ocorreu um erro ao atualizar o catálogo. Exibindo versões em cache (se houver).');
  }
  buildConsoleFilter();
  restoreUIControls();
  renderCatalog();
}

function showCatalogNotice(msg){
  // cria/atualiza um aviso discreto no banner do catálogo
  const catalog = $('catalogView');
  if (!catalog) return;
  let note = catalog.querySelector('[data-note]');
  if (!note) {
    note = document.createElement('div');
    note.dataset.note = '1';
    note.className = 'muted';
    note.style.margin = '8px 0 0';
    const banner = catalog.querySelector('.banner') || catalog;
    banner.appendChild(note);
  }
  note.textContent = msg;
}

function buildConsoleFilter(){
  const sel = $('filterConsole');
  if (!sel) return;
  // limpa e reconstroi mantendo a 1ª opção
  sel.innerHTML = '<option value="">Todos os consoles</option>';
  const consoles = [...new Set(state.products.map(p=>p.console))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  consoles.forEach(c=>{
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

function restoreUIControls(){
  const q = $('searchInput'), fc = $('filterConsole'), ss = $('sortSelect');
  if (q) q.value = state.ui.q || '';
  if (fc) fc.value = state.ui.console || '';
  if (ss) ss.value = state.ui.sort || 'relevance';
}

/* ---------- RENDER CATALOG ---------- */
const PLACEHOLDER = './img/placeholder.jpg';

function createCard(p){
  const card = document.createElement('article');
  card.className = 'card';

  const img = document.createElement('img');
  img.alt = p.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = p.image || PLACEHOLDER;
  img.className = 'product-cover';
  img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });
  card.appendChild(img);

  const titleWrap = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = p.name;
  const br = document.createElement('br');
  const small = document.createElement('small');
  small.textContent = p.console;
  titleWrap.append(strong, br, small);
  card.appendChild(titleWrap);

  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = money(p.price);
  card.appendChild(price);

  const row = document.createElement('div');
  row.className = 'row';

  const btnDetail = document.createElement('button');
  btnDetail.className = 'btn';
  btnDetail.textContent = 'Detalhes';
  btnDetail.setAttribute('aria-label', `Ver detalhes de ${p.name}`);
  btnDetail.onclick = ()=>openProduct(p.id);

  const btnAdd = document.createElement('button');
  btnAdd.className = 'btn btn-primary';
  btnAdd.textContent = 'Adicionar';
  btnAdd.setAttribute('aria-label', `Adicionar ${p.name} ao carrinho`);
  btnAdd.onclick = ()=>addToCart(p,1);

  row.append(btnDetail, btnAdd);
  card.appendChild(row);

  return card;
}

function renderCatalog(){
  const grid = $('catalogGrid');
  if (!grid) return;

  const q = (($('searchInput')?.value)||'').toLowerCase().trim();
  const filterConsole = $('filterConsole')?.value || '';
  const sortBy = $('sortSelect')?.value || 'relevance';

  state.ui = { q, console: filterConsole, sort: sortBy }; // persist UI
  saveUI();

  let items = state.products.filter(p =>
    (!filterConsole || p.console === filterConsole) &&
    (p.name.toLowerCase().includes(q) || p.console.toLowerCase().includes(q))
  );

  const sorters = {
    relevance: (a,b)=>0,
    priceAsc: (a,b)=>a.price-b.price,
    priceDesc: (a,b)=>b.price-a.price,
    nameAsc: (a,b)=>a.name.localeCompare(b.name,'pt-BR'),
  };
  items.sort(sorters[sortBy] || sorters.relevance);

  grid.innerHTML = '';
  if (items.length === 0){
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhum item encontrado com os filtros aplicados.';
    grid.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach(p=>frag.appendChild(createCard(p)));
  grid.appendChild(frag);
}

/* Debounce leve para inputs (suave no mobile) */
function debounce(fn, ms=120){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

/* ---------- PRODUCT DETAIL ---------- */
function openProduct(id){
  const p = state.products.find(x=>x.id===id);
  if (!p) return;

  const el = $('productDetail');
  if (!el) return;

  el.innerHTML = ''; // limpa
  const card = document.createElement('article');
  card.className = 'card';

  const img = document.createElement('img');
  img.alt = p.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = p.image || PLACEHOLDER;
  img.className = 'product-cover';
  img.style.borderRadius = '12px';
  img.addEventListener('error', () => { img.src = PLACEHOLDER; }, { once: true });

  const h2 = document.createElement('h2'); h2.textContent = p.name;
  const consoleEl = document.createElement('div'); consoleEl.className = 'muted'; consoleEl.textContent = p.console;
  const price = document.createElement('div'); price.className = 'price'; price.textContent = money(p.price);
  const desc = document.createElement('p'); desc.textContent = p.description || '';

  const row = document.createElement('div'); row.className = 'row';
  const span = document.createElement('span'); span.textContent = 'Qtd:';
  const qtdWrap = document.createElement('div'); qtdWrap.className = 'qtd';

  const btnDec = document.createElement('button'); btnDec.className = 'btn'; btnDec.textContent = '-';
  const qtdVal = document.createElement('strong'); qtdVal.textContent = '1';
  const btnInc = document.createElement('button'); btnInc.className = 'btn'; btnInc.textContent = '+';
  const btnAdd = document.createElement('button'); btnAdd.className = 'btn btn-primary'; btnAdd.textContent = 'Adicionar ao Carrinho';

  let qtd = 1;
  btnDec.onclick = ()=>{ if(qtd>1){ qtd--; qtdVal.textContent = String(qtd); } };
  btnInc.onclick = ()=>{ qtd++; qtdVal.textContent = String(qtd); };
  btnAdd.onclick = ()=>addToCart(p,qtd);

  qtdWrap.append(btnDec, qtdVal, btnInc);
  row.append(span, qtdWrap, btnAdd);

  const shipping = document.createElement('div'); shipping.className = 'shipping';
  const lab = document.createElement('label'); lab.textContent = 'Calcular frete';
  const row2 = document.createElement('div'); row2.className = 'row';
  const cep = document.createElement('input'); cep.id = 'cepDetail'; cep.className = 'input'; cep.placeholder = '00000-000'; cep.inputMode = 'numeric'; cep.pattern = '\\d{5}-?\\d{3}';
  const calc = document.createElement('button'); calc.id = 'calcDetail'; calc.className = 'btn'; calc.textContent = 'Calcular';
  const out = document.createElement('div'); out.id = 'freteDetail'; out.className = 'muted';

  calc.onclick = ()=>{
    const val = cep.value.trim();
    calcFrete(val);
    out.textContent = `${state.freight.label}: ${money(state.freight.value)}`;
  };

  row2.append(cep, calc);
  shipping.append(lab, row2, out);

  card.append(img, h2, consoleEl, price, desc, row, shipping);
  el.appendChild(card);

  route('productView');
}

/* ---------- CART ---------- */
function addToCart(p, qtd){
  const idx = state.cart.findIndex(i=>i.id===p.id);
  if(idx>-1){ state.cart[idx].qtd += qtd; }
  else { state.cart.push({ id:p.id, name:p.name, price:p.price, image:p.image || PLACEHOLDER, qtd }); }
  saveCart();
  renderCart();
}

function renderCart(){
  const box = $('cartItems');
  if(!box) return;
  if(state.cart.length===0){
    box.innerHTML = '<p class="muted">Seu carrinho está vazio.</p>';
  }else{
    box.innerHTML = '';
    state.cart.forEach((i,ix)=>{
      const row = document.createElement('div');
      row.className = 'list';
      row.innerHTML = `
        <div class="row" style="justify-content:space-between">
          <div>
            <strong>${i.name}</strong><br><small>${money(i.price)}</small>
          </div>
          <div class="row">
            <button class="btn" data-act="dec" aria-label="Diminuir quantidade">-</button>
            <strong>${i.qtd}</strong>
            <button class="btn" data-act="inc" aria-label="Aumentar quantidade">+</button>
            <button class="btn" data-act="rm" aria-label="Remover do carrinho">Remover</button>
          </div>
        </div>`;
      row.querySelector('[data-act="dec"]').onclick = ()=>{ if(i.qtd>1){ i.qtd--; saveCart(); renderCart(); } };
      row.querySelector('[data-act="inc"]').onclick = ()=>{ i.qtd++; saveCart(); renderCart(); };
      row.querySelector('[data-act="rm"]').onclick = ()=>{ state.cart.splice(ix,1); saveCart(); renderCart(); };
      box.appendChild(row);
    });
  }
  calcFrete($('cepInput')?.value);
  const subtotal = state.cart.reduce((s,i)=>s+i.price*i.qtd,0);
  const total = subtotal + state.freight.value;
  $('cartTotals').innerHTML =
    `<div>Subtotal: <strong>${money(subtotal)}</strong></div>
     <div>Frete: <strong>${money(state.freight.value)}</strong> <small class="muted">(${state.freight.label||'Calcule pelo CEP'})</small></div>
     <div style="font-size:1.1rem">TOTAL: <strong>${money(total)}</strong></div>`;
}

function goCheckout(){
  $('checkoutSummary').innerHTML = $('cartTotals').innerHTML;
  route('checkoutView');
}

function placeOrder(formData){
  const subtotal = state.cart.reduce((s,i)=>s+i.price*i.qtd,0);
  const total = subtotal + state.freight.value;
  const order = {
    id: 'WR-' + Date.now(),
    items: state.cart.map(i=>({name:i.name, price:i.price, qtd:i.qtd})),
    freight: state.freight,
    totals: { subtotal, total },
    customer: {
      nome: formData.get('nome'),
      email: formData.get('email'),
      telefone: formData.get('telefone')||'',
      endereco: {
        cep: formData.get('cep'), endereco: formData.get('endereco'),
        bairro: formData.get('bairro'), cidade: formData.get('cidade'), estado: formData.get('estado')
      },
    },
    payment: formData.get('pagamento'),
    status: 'Pagamento pendente',
    createdAt: new Date().toISOString(),
  };
  state.orders.unshift(order);
  saveOrders();
  state.cart = []; saveCart();
  alert(`Pedido ${order.id} criado! (protótipo)\nTotal: ${money(order.totals.total)}\nForma de pagamento: ${String(order.payment || '').toUpperCase()}`);
  renderOrders();
  route('ordersView');
}

function renderOrders(){
  const box = $('ordersList');
  if (!box) return;
  box.innerHTML = '';
  if(state.orders.length===0){
    box.innerHTML = '<p class="muted">Nenhum pedido ainda.</p>';
    return;
  }
  state.orders.forEach(o=>{
    const el = document.createElement('div');
    el.className = 'list';
    const when = new Date(o.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    el.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div>
          <strong>Pedido ${o.id}</strong><br>
          <small>${when}</small><br>
          <small>Status: ${o.status}</small>
        </div>
        <div>
          <div><strong>${money(o.totals.total)}</strong></div>
          <div class="muted">${o.items.length} item(ns)</div>
        </div>
      </div>`;
    box.appendChild(el);
  });
}

/* ---------- EVENTS ---------- */
window.addEventListener('DOMContentLoaded', async ()=>{
  // nav
  $('navCatalog').onclick = ()=>route('catalogView');
  $('navOrders').onclick = ()=>{ renderOrders(); route('ordersView'); };
  $('navSupport').onclick = ()=>route('supportView');
  $('openCart').onclick = ()=>{ renderCart(); route('cartView'); };

  // back
  $('backToCatalog').onclick = ()=>route('catalogView');
  $('backFromCart').onclick = ()=>route('catalogView');
  $('backFromCheckout').onclick = ()=>route('cartView');
  $('backFromOrders').onclick = ()=>route('catalogView');
  $('backFromSupport').onclick = ()=>route('catalogView');

  // frete (carrinho)
  $('calcFrete').onclick = ()=>{
    const cep = $('cepInput').value.trim();
    calcFrete(cep);
    $('freteResult').textContent = `${state.freight.label}: ${money(state.freight.value)}`;
    renderCart();
  };

  // checkout
  $('goCheckout').onclick = ()=>goCheckout();
  $('checkoutForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    placeOrder(fd);
  });

  // filtros catálogo (com debounce)
  const debouncedRender = debounce(renderCatalog, 140);
  ['searchInput','filterConsole','sortSelect'].forEach(id=>{
    const el = $(id);
    if (!el) return;
    const ev = (id === 'searchInput') ? 'input' : 'change';
    el.addEventListener(ev, ()=>{
      // atualiza state.ui já que restoreUIControls pode chamar depois
      if (id === 'searchInput') state.ui.q = el.value;
      if (id === 'filterConsole') state.ui.console = el.value;
      if (id === 'sortSelect') state.ui.sort = el.value;
      saveUI();
      debouncedRender();
    });
  });

  updateCartCount();
  await loadProducts(); // carrega + renderCatalog()
});
