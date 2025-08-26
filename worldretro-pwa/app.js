// World Retro PWA Prototype - Cart, Catalog, Checkout
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('wr_cart')||'[]'),
  freight: { value: 0, label: '' },
  orders: JSON.parse(localStorage.getItem('wr_orders')||'[]'),
};

const money = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function saveCart(){ localStorage.setItem('wr_cart', JSON.stringify(state.cart)); updateCartCount(); }
function saveOrders(){ localStorage.setItem('wr_orders', JSON.stringify(state.orders)); }

// Simple freight rule: R$22,90 base + R$5 por item além do primeiro; grátis acima de R$300
function calcFrete(cep){
  const total = state.cart.reduce((s,i)=>s+i.price*i.qtd,0);
  if(total >= 300){ state.freight = { value: 0, label: 'Frete grátis (pedidos acima de R$ 300,00)' }; return; }
  const qty = state.cart.reduce((s,i)=>s+i.qtd,0);
  const val = 22.90 + Math.max(0, qty-1)*5;
  const label = `Padrão (${cep || 'CEP não informado'})`;
  state.freight = { value: Number(val.toFixed(2)), label };
}

function updateCartCount(){
  const n = state.cart.reduce((s,i)=>s+i.qtd,0);
  document.getElementById('cartCount').textContent = n;
}

function route(viewId){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadProducts(){
  const res = await fetch('products.json');
  state.products = await res.json();
  buildConsoleFilter();
  renderCatalog();
}

function buildConsoleFilter(){
  const consoles = [...new Set(state.products.map(p=>p.console))].sort();
  const sel = document.getElementById('filterConsole');
  consoles.forEach(c=>{
    const o = document.createElement('option');
    o.value = c; o.textContent = c; sel.appendChild(o);
  });
}

function renderCatalog(){
  const q = (document.getElementById('searchInput').value||'').toLowerCase();
  const filterConsole = document.getElementById('filterConsole').value;
  const sortBy = document.getElementById('sortSelect').value;

  let items = state.products.filter(p=>
    (!filterConsole || p.console===filterConsole) &&
    (p.name.toLowerCase().includes(q) || p.console.toLowerCase().includes(q))
  );

  const sorters = {
    relevance: (a,b)=>0,
    priceAsc: (a,b)=>a.price-b.price,
    priceDesc: (a,b)=>b.price-a.price,
    nameAsc: (a,b)=>a.name.localeCompare(b.name,'pt-BR'),
  };
  items.sort(sorters[sortBy]);

  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = '';
  items.forEach(p=>{
    const card = document.createElement('article');
    card.className = 'card';

    const img = document.createElement('img');
    img.alt = p.name;
    img.src = p.image || 'placeholder.jpg';
    card.appendChild(img);

    const title = document.createElement('div');
    title.innerHTML = `<strong>${p.name}</strong><br><small>${p.console}</small>`;
    card.appendChild(title);

    const price = document.createElement('div');
    price.className = 'price'; price.textContent = money(p.price);
    card.appendChild(price);

    const row = document.createElement('div'); row.className = 'row';
    const btnDetail = document.createElement('button');
    btnDetail.className = 'btn'; btnDetail.textContent = 'Detalhes';
    btnDetail.onclick = ()=>openProduct(p.id);
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn-primary'; btnAdd.textContent = 'Adicionar';
    btnAdd.onclick = ()=>addToCart(p,1);
    row.append(btnDetail, btnAdd);
    card.appendChild(row);

    grid.appendChild(card);
  });
}

function openProduct(id){
  const p = state.products.find(x=>x.id===id);
  const el = document.getElementById('productDetail');
  el.innerHTML = `
    <article class="card">
      <img alt="${p.name}" src="${p.image || 'placeholder.jpg'}" style="height:220px;object-fit:cover;border-radius:12px">
      <h2>${p.name}</h2>
      <div class="muted">${p.console}</div>
      <div class="price">${money(p.price)}</div>
      <p>${p.description}</p>
      <div class="row">
        <span>Qtd:</span>
        <div class="qtd">
          <button class="btn" id="dec">-</button>
          <strong id="qtdVal">1</strong>
          <button class="btn" id="inc">+</button>
        </div>
        <button class="btn btn-primary" id="add">Adicionar ao Carrinho</button>
      </div>
      <div class="shipping">
        <label>Calcular frete</label>
        <div class="row">
          <input id="cepDetail" class="input" placeholder="00000-000">
          <button id="calcDetail" class="btn">Calcular</button>
        </div>
        <div id="freteDetail" class="muted"></div>
      </div>
    </article>
  `;
  let qtd = 1;
  el.querySelector('#dec').onclick = ()=>{ if(qtd>1){ qtd--; el.querySelector('#qtdVal').textContent = qtd; } };
  el.querySelector('#inc').onclick = ()=>{ qtd++; el.querySelector('#qtdVal').textContent = qtd; };
  el.querySelector('#add').onclick = ()=>addToCart(p,qtd);
  el.querySelector('#calcDetail').onclick = ()=>{
    const cep = el.querySelector('#cepDetail').value.trim();
    calcFrete(cep); el.querySelector('#freteDetail').textContent = `${state.freight.label}: ${money(state.freight.value)}`;
  };
  route('productView');
}

function addToCart(p, qtd){
  const idx = state.cart.findIndex(i=>i.id===p.id);
  if(idx>-1){ state.cart[idx].qtd += qtd; }
  else { state.cart.push({ id:p.id, name:p.name, price:p.price, image:p.image, qtd }); }
  saveCart();
  renderCart();
}

function renderCart(){
  const box = document.getElementById('cartItems');
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
            <button class="btn" data-act="dec">-</button>
            <strong>${i.qtd}</strong>
            <button class="btn" data-act="inc">+</button>
            <button class="btn" data-act="rm">Remover</button>
          </div>
        </div>`;
      row.querySelector('[data-act="dec"]').onclick = ()=>{ if(i.qtd>1){ i.qtd--; saveCart(); renderCart(); } };
      row.querySelector('[data-act="inc"]').onclick = ()=>{ i.qtd++; saveCart(); renderCart(); };
      row.querySelector('[data-act="rm"]').onclick = ()=>{ state.cart.splice(ix,1); saveCart(); renderCart(); };
      box.appendChild(row);
    });
  }
  calcFrete(document.getElementById('cepInput')?.value);
  const subtotal = state.cart.reduce((s,i)=>s+i.price*i.qtd,0);
  const total = subtotal + state.freight.value;
  document.getElementById('cartTotals').innerHTML =
    `<div>Subtotal: <strong>${money(subtotal)}</strong></div>
     <div>Frete: <strong>${money(state.freight.value)}</strong> <small class="muted">(${state.freight.label||'Calcule pelo CEP'})</small></div>
     <div style="font-size:1.1rem">TOTAL: <strong>${money(total)}</strong></div>`;
}

function goCheckout(){
  document.getElementById('checkoutSummary').innerHTML = document.getElementById('cartTotals').innerHTML;
  route('checkoutView');
}

function placeOrder(formData){
  const order = {
    id: 'WR-' + Date.now(),
    items: state.cart.map(i=>({name:i.name, price:i.price, qtd:i.qtd})),
    freight: state.freight,
    totals: {
      subtotal: state.cart.reduce((s,i)=>s+i.price*i.qtd,0),
      total: state.cart.reduce((s,i)=>s+i.price*i.qtd,0) + state.freight.value,
    },
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
  alert(`Pedido ${order.id} criado! (protótipo)\nTotal: ${money(order.totals.total)}\nForma de pagamento: ${order.payment.toUpperCase()}`);
  renderOrders();
  route('ordersView');
}

function renderOrders(){
  const box = document.getElementById('ordersList');
  box.innerHTML = '';
  if(state.orders.length===0){
    box.innerHTML = '<p class="muted">Nenhum pedido ainda.</p>';
    return;
  }
  state.orders.forEach(o=>{
    const el = document.createElement('div');
    el.className = 'list';
    el.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <div>
          <strong>Pedido ${o.id}</strong><br>
          <small>${new Date(o.createdAt).toLocaleString('pt-BR')}</small><br>
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

// Events
window.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('navCatalog').onclick = ()=>route('catalogView');
  document.getElementById('navOrders').onclick = ()=>{ renderOrders(); route('ordersView'); };
  document.getElementById('navSupport').onclick = ()=>route('supportView');
  document.getElementById('openCart').onclick = ()=>{ renderCart(); route('cartView'); };

  document.getElementById('backToCatalog').onclick = ()=>route('catalogView');
  document.getElementById('backFromCart').onclick = ()=>route('catalogView');
  document.getElementById('backFromCheckout').onclick = ()=>route('cartView');
  document.getElementById('backFromOrders').onclick = ()=>route('catalogView');
  document.getElementById('backFromSupport').onclick = ()=>route('catalogView');

  document.getElementById('calcFrete').onclick = ()=>{
    const cep = document.getElementById('cepInput').value.trim();
    calcFrete(cep);
    document.getElementById('freteResult').textContent = `${state.freight.label}: ${money(state.freight.value)}`;
    renderCart();
  };

  document.getElementById('goCheckout').onclick = ()=>goCheckout();
  document.getElementById('checkoutForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    placeOrder(fd);
  });

  ['searchInput','filterConsole','sortSelect'].forEach(id=>{
    document.getElementById(id).addEventListener('input', renderCatalog);
    document.getElementById(id).addEventListener('change', renderCatalog);
  });

  updateCartCount();
  await loadProducts();
  renderCatalog();
});
