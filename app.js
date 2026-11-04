import { products as seedProducts, categories, cities, icon, migrateLegacyData } from './data.js';
import { initPortals } from './portals.js';
import { initAssistant } from './ai.js';
let portalController = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => `${new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0))} ₸`;
const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const storageKey = 'lows-market-v1';
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const relativeDate = days => { const d = today(); d.setDate(d.getDate() + days); return d; };
const dateText = date => new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long' }).format(date);
const defaultState = () => ({ city: 'Almaty', cart: {}, favorites: [], orders: [], listings: [], donations: [], reports: [], exclusions: [] });
let state = defaultState();
try {
  const cached = migrateLegacyData(JSON.parse(localStorage.getItem(storageKey)));
  if (cached && typeof cached === 'object') {
    for (const key of ['favorites', 'orders', 'listings', 'donations', 'reports', 'exclusions']) if (Array.isArray(cached[key])) state[key] = cached[key];
    if (cities[cached.city]) state.city = cached.city;
    if (cached.cart && typeof cached.cart === 'object' && !Array.isArray(cached.cart)) state.cart = cached.cart;
  }
} catch { /* A fresh local demo also works when browser storage is unavailable. */ }
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validText = (value, max = 2000) => typeof value === 'string' && value.length <= max;
state.listings = state.listings.filter(p => p && /^custom-\d+-[a-z0-9]+$/.test(p.id) && ['name', 'store', 'subtitle', 'description', 'ingredients', 'allergens', 'storage', 'pickup'].every(k => validText(p[k])) && cities[p.city] && categories.some(c => c.id === p.category && c.id !== 'all') && ['bakery.jpg', 'vegetables.jpg', 'fruit.jpg', 'dairy.jpg', 'lunch.jpg', 'bread.jpg'].includes(p.image) && Number.isFinite(p.price) && p.price > 0 && Number.isFinite(p.original) && p.original > p.price && Number.isInteger(p.stock) && p.stock >= 0 && Number.isFinite(p.weight) && p.weight > 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.expiration) && validDate(p.expiration));
state.orders = state.orders.filter(o => o && validText(o.id, 40) && validDate(o.createdAt) && cities[o.city] && ['savings', 'weight', 'total', 'fee'].every(k => Number.isFinite(o[k]) && o[k] >= 0) && Array.isArray(o.items) && o.items.length && o.items.every(i => i && validText(i.id, 80) && Number.isInteger(i.quantity) && i.quantity > 0 && Number.isFinite(i.price) && Number.isFinite(i.weight)));
state.favorites = [...new Set(state.favorites.filter(id => [...seedProducts, ...state.listings].some(p => p.id === id)))];
state.reports = state.reports.filter(r => r && validText(r.orderId, 40) && validDate(r.createdAt) && validText(r.description));
state.donations = state.donations.filter(d => d && validText(d.id, 40) && validText(d.organization) && validText(d.description) && cities[d.city]);
const ui = { category: 'all', search: '', sort: 'recommended', maxPrice: '', diet: 'all', expiry: 'all', delivery: false, modal: null, modalId: null, detailQuantity: 1, mapSelection: null, partnerTab: 'inventory', checkout: null };
let toastTimer;
let lastFocused;
const dialog = $('#app-dialog');
const catalogProducts = () => [...seedProducts, ...state.listings];
const product = id => catalogProducts().find(p => p.id === id);
const daysLeft = p => p.expiration ? Math.ceil((new Date(`${p.expiration}T00:00:00`) - today()) / 86400000) : p.days;
const expiryDate = p => p.expiration ? new Date(`${p.expiration}T00:00:00`) : relativeDate(p.days);
const expiryLabel = p => daysLeft(p) === 0 ? 'Good until the end of the day' : daysLeft(p) === 1 ? 'Good until tomorrow' : `Best before ${dateText(expiryDate(p))}`;
const reserved = id => state.orders.filter(o => !o.cancelled && o.city === (product(id)?.city || state.city) && (id.startsWith('custom-') || o.day === dayKey())).reduce((sum, o) => sum + o.items.filter(i => i.id === id).reduce((q, i) => q + i.quantity, 0), 0);
const available = p => Math.max(0, Math.floor(p.stock) - reserved(p.id));
const inCity = p => !p.city || p.city === state.city;
const listed = p => !p.paused && !p.blocked && !p.pending && !p.ownerSuspended && !p.ownerRoleInvalid && !state.exclusions.includes(p.category);
const productImage = p => typeof p.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo) ? p.photo : `./assets/images/${p.image}`;
const shopperOrders = () => state.orders.filter(o => !o.buyerId || o.buyerId === portalController?.user()?.id);
const cartItems = () => Object.entries(state.cart).map(([id, qty]) => ({ p: product(id), qty })).filter(({ p, qty }) => p && inCity(p) && listed(p) && daysLeft(p) >= 0 && Number.isInteger(qty) && qty > 0);
const totals = (items = cartItems()) => items.reduce((s, { p, qty }) => ({ price: s.price + p.price * qty, original: s.original + p.original * qty, weight: s.weight + p.weight * qty, count: s.count + qty }), { price: 0, original: 0, weight: 0, count: 0 });
const discount = p => Math.round((1 - p.price / p.original) * 100);
const address = p => `${state.city}, ${p.category === 'vegetables' || p.category === 'fruit' ? cities[state.city].second : cities[state.city].street}`;
const categoryName = id => categories.find(c => c.id === id)?.name || 'Products';
function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { notify('The browser does not allow saving. The data is available until the page is reloaded.'); } }
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3300); }
function empty(title, text, action = '', label = '') { return `<div class="empty-state">${icon('bag')}<h3>${escape(title)}</h3><p>${escape(text)}</p>${action ? `<button class="button primary" data-action="${action}">${escape(label)}</button>` : ''}</div>`; }
function cleanCart() {
  const clean = {};
  for (const { p, qty } of cartItems()) { const count = Math.min(qty, available(p)); if (count > 0) clean[p.id] = count; }
  state.cart = clean;
}
cleanCart();

function quantityControl(id, qty, limit, mode = 'cart') {
  return `<div class="quantity-control"><button data-action="${mode === 'detail' ? 'detail-minus' : 'minus'}" data-id="${escape(id)}" aria-label="Reduce quantity ${escape(product(id)?.name)}">${icon('minus')}</button><strong aria-label="Quantity">${qty}</strong><button data-action="${mode === 'detail' ? 'detail-plus' : 'add'}" data-id="${escape(id)}" aria-label="Increase quantity ${escape(product(id)?.name)}" ${qty >= limit ? 'disabled' : ''}>${icon('plus')}</button></div>`;
}
function productCard(p) {
  const qty = state.cart[p.id] || 0, left = available(p), favorite = state.favorites.includes(p.id);
  return `<article class="product-card"><div class="product-image-button" role="button" tabindex="0" data-action="product" data-id="${escape(p.id)}" aria-label="More details: ${escape(p.name)}"><img src="${escape(productImage(p))}" alt="${escape(p.name)}" loading="lazy" width="450" height="310" /><span class="card-discount">−${discount(p)}%</span>${p.tag ? `<span class="card-tag">${icon(p.category === 'surprise' ? 'gift' : p.diet === 'vegan' ? 'leaf' : 'sprout')}${escape(p.tag)}</span>` : ''}</div><button class="card-favorite ${favorite ? 'selected' : ''}" data-action="favorite" data-id="${escape(p.id)}" aria-label="${favorite ? 'Remove from favorites' : 'Add to favorites'}: ${escape(p.name)}" aria-pressed="${favorite}">${icon('heart')}</button><div class="card-body"><div class="store-line"><span class="store-avatar" style="background:${/^#[a-fA-F0-9]{6}$/.test(p.color) ? p.color : '#e2e8d6'}">${escape(p.store.slice(0, 1))}</span><span>${escape(p.store)}</span><span>${p.delivery ? 'Delivery / Pickup' : 'Pickup'}</span></div><button class="card-title" data-action="product" data-id="${escape(p.id)}">${escape(p.name)}</button><p class="card-subtitle">${escape(p.subtitle)}</p><div class="expiry-line ${daysLeft(p) === 0 ? 'today' : ''}">${icon('clock')}<span>${escape(expiryLabel(p))}</span></div><div class="card-price-row"><span class="price">${money(p.price).replace('₸', '<span class="currency">₸</span>')}</span><span class="old-price">${money(p.original)}</span>${qty ? quantityControl(p.id, qty, left) : `<button class="add-button" data-action="add" data-id="${escape(p.id)}" aria-label="Add to cart: ${escape(p.name)}" ${!left ? 'disabled' : ''}>${icon('plus')}</button>`}</div><div class="card-bottom"><span>${icon('store')}Pick up ${escape(p.pickup)}</span><span class="card-stock">${left ? `Remaining: ${left}` : 'Sold out'}</span></div></div></article>`;
}
function filteredProducts() {
  let list = catalogProducts().filter(p => inCity(p) && listed(p) && daysLeft(p) >= 0);
  if (ui.category !== 'all') list = list.filter(p => p.category === ui.category);
  if (ui.search.trim()) { const q = ui.search.toLocaleLowerCase('en').trim(); list = list.filter(p => `${p.name} ${p.subtitle} ${p.store} ${categoryName(p.category)}`.toLocaleLowerCase('en').includes(q)); }
  if (ui.maxPrice !== '') list = list.filter(p => p.price <= Number(ui.maxPrice));
  if (ui.diet !== 'all') list = list.filter(p => ui.diet === 'vegan' ? p.diet === 'vegan' : ['vegan', 'vegetarian'].includes(p.diet));
  if (ui.expiry === 'today') list = list.filter(p => daysLeft(p) === 0);
  if (ui.expiry === 'tomorrow') list = list.filter(p => daysLeft(p) >= 1);
  if (ui.delivery) list = list.filter(p => p.delivery);
  if (ui.sort === 'price') list.sort((a, b) => a.price - b.price);
  if (ui.sort === 'discount') list.sort((a, b) => discount(b) - discount(a));
  if (ui.sort === 'expiry') list.sort((a, b) => daysLeft(a) - daysLeft(b));
  return list;
}
function renderCatalog() {
  const focused = captureFocus();
  $('#categories').innerHTML = categories.map(c => `<button class="category ${ui.category === c.id ? 'active' : ''}" data-action="category" data-category="${c.id}" aria-pressed="${ui.category === c.id}">${icon(c.icon)}${c.name}</button>`).join('');
  const list = filteredProducts();
  $('#results-count').textContent = `${list.length} ${plural(list.length, ['offer', 'offers'])} · ${state.city}`;
  $('#product-grid').innerHTML = list.length ? list.map(productCard).join('') : empty('Nothing found yet', 'Try a different category or remove some filters.', 'reset-filters', 'Reset search and filters');
  const filterCount = [ui.maxPrice !== '', ui.diet !== 'all', ui.expiry !== 'all', ui.delivery].filter(Boolean).length;
  $('.filter-count').textContent = filterCount; $('.filter-count').hidden = !filterCount;
  restoreFocus(focused);
}
function plural(n, forms) { return forms[n === 1 ? 0 : 1]; }
function refresh({ modal = true } = {}) {
  $('#current-city').textContent = state.city;
  $('#cart-count').textContent = totals().count;
  $('.cart-button').setAttribute('aria-label', `Cart, ${totals().count} items`);
  $('#favorite-count').textContent = state.favorites.length;
  $('#favorite-count').hidden = state.favorites.length === 0;
  renderCatalog();
  if (modal && ['cart', 'favorites', 'product', 'partner', 'store'].includes(ui.modal)) renderModal();
}
function resetFilters() {
  Object.assign(ui, { category: 'all', search: '', maxPrice: '', diet: 'all', expiry: 'all', delivery: false, sort: 'recommended' });
  $('#search').value = ''; $('#max-price').value = ''; $('#diet').value = 'all'; $('#expiry').value = 'all'; $('#delivery-filter').checked = false; $('#sort').value = 'recommended'; renderCatalog();
}
function changeQuantity(id, delta) {
  const p = product(id); if (!p || !inCity(p) || !listed(p) || daysLeft(p) < 0) return;
  const next = (state.cart[id] || 0) + delta;
  if (next > available(p)) return notify('No longer available. Try another tasty option.');
  if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
  save(); refresh();
  if (delta > 0 && next === 1 && ui.modal !== 'cart') notify('Added to cart');
}

function captureFocus() {
  const el = document.activeElement;
  return el && el.matches('[data-action]') ? { el, action: el.dataset.action, id: el.dataset.id, category: el.dataset.category, tab: el.dataset.tab, modal: dialog.contains(el) } : null;
}
function restoreFocus(saved) {
  if (!saved || saved.el.isConnected) return;
  const scope = saved.modal ? dialog : document;
  let next = $$('[data-action]', scope).find(el => el.dataset.action === saved.action && el.dataset.id === saved.id && el.dataset.category === saved.category && el.dataset.tab === saved.tab && !el.disabled);
  if (!next && saved.id) next = $$('[data-id]', scope).find(el => el.dataset.id === saved.id && el.matches('button') && !el.disabled);
  if (next) next.focus({ preventScroll: true });
}
function modalShell(title, body, subtitle = '', drawer = false) {
  dialog.classList.toggle('drawer', drawer);
  $('#dialog-content').innerHTML = `<div class="dialog-header"><div><h2 id="dialog-title">${escape(title)}</h2>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}</div><button class="icon-button" data-action="close" aria-label="Close window">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
}
function openModal(type, id = null) {
  if (!dialog.open) lastFocused = document.activeElement;
  ui.modal = type; ui.modalId = id;
  if (type === 'product') ui.detailQuantity = 1;
  renderModal();
  if (!dialog.open) { dialog.showModal(); document.body.style.overflow = 'hidden'; }
  dialog.scrollTop = 0;
  $('.dialog-header [data-action="close"]')?.focus({ preventScroll: true });
}
function closeModal() { dialog.close(); }
dialog.addEventListener('close', () => { ui.modal = null; ui.modalId = null; document.body.style.overflow = ''; if (lastFocused?.isConnected) lastFocused.focus({ preventScroll: true }); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
const demoNotice = (text = 'Training prototype. The data and actions are for demonstration purposes, no money is debited.') => `<div class="demo-notice">${icon('info')}<span>${escape(text)}</span></div>`;

function renderModal() {
  const focused = captureFocus();
  if (ui.modal === 'city') {
    modalShell('Where do we look for something tasty?', `${Object.keys(cities).map(city => `<button class="city-option ${state.city === city ? 'active' : ''}" data-action="select-city" data-city="${city}">${icon('pin')}${city}${state.city === city ? icon('check') : ''}</button>`).join('')}<p>These are display cases. When you change the city, the cart is cleared, your favorites and history are saved.</p>`, 'Select a city for the demo catalog');
    $('.dialog-body').classList.add('city-list');
  }
  if (ui.modal === 'product') renderProduct();
  if (ui.modal === 'cart') renderCart();
  if (ui.modal === 'checkout') renderCheckout();
  if (ui.modal === 'success') renderSuccess();
  if (ui.modal === 'favorites') {
    const favorites = catalogProducts().filter(p => state.favorites.includes(p.id) && inCity(p) && listed(p) && daysLeft(p) >= 0);
    modalShell('Your delicious finds', favorites.length ? `<div class="favorite-list">${favorites.map(productCard).join('')}</div>` : empty('Save for later', 'Click on the heart of the product you like. Favorites are shown for the selected city.', 'close', 'View catalog'), `${favorites.length} in favorites · ${state.city}`);
  }
  if (ui.modal === 'orders') renderOrders();
  if (ui.modal === 'tracking') renderTracking();
  if (ui.modal === 'report') renderReport();
  if (ui.modal === 'impact') renderImpact();
  if (ui.modal === 'map') renderMap();
  if (ui.modal === 'store') renderStore();
  if (ui.modal === 'partner') renderPartner();
  if (ui.modal === 'listing') renderListingForm();
  if (ui.modal === 'donation') renderDonation();
  if (ui.modal === 'donation-form') renderDonationForm();
  if (ui.modal === 'about') modalShell('Oh LowS Market', `<p>LowS Market — training project for a marketplace of products with a short remaining shelf life for Kazakhstan. The idea brings together shoppers, local shops, cafes and bakeries.</p><div class="detail-notes"><div><h3>Project team</h3><p>Ramazan Yerubay<br>Khamidulla Sanzhar<br>Oralbay Dias<br>Yeshenkulov Tamirlan</p></div><div><h3>Concept</h3><p>Discounts of 40-70%, products with known composition and mystery bundles, pickup and delivery, helping the community and counting saved food.</p></div></div><div style="margin-top:20px">${demoNotice('All stores, prices, addresses and availability are for demonstration purposes only. Real payments, authorization, seller verification and delivery are not included in this version.')}</div>`);
  restoreFocus(focused);
}
function renderProduct() {
  const p = product(ui.modalId); if (!p) return;
  const left = available(p); ui.detailQuantity = Math.max(1, Math.min(ui.detailQuantity, left - (state.cart[p.id] || 0)));
  modalShell(p.name, `<div class="dialog-product"><div class="detail-photo"><img src="${escape(productImage(p))}" alt="${escape(p.name)}" /><span class="card-discount">−${discount(p)}%</span></div><div><p class="detail-subtitle">${escape(p.subtitle)}</p><div class="detail-price"><strong class="price">${money(p.price)}</strong><span class="old-price">${money(p.original)}</span></div><div class="detail-data"><div>${icon('store')}<div><button class="store-detail-button" data-action="store" data-id="${escape(p.id)}">${escape(p.store)}</button><span style="display:block">${escape(address(p))} · demo</span></div></div><div>${icon('clock')}<div><b>Best before ${dateText(expiryDate(p))}, 23:59</b><span>Receipt: ${escape(p.pickup)}</span></div></div><div>${icon(p.delivery ? 'truck' : 'bag')}<div><b>${p.delivery ? 'Pickup or delivery' : 'Pickup only'}</b><span>In stock: ${left} ${plural(left, ['pcs.', 'pcs.', 'pcs.'])}</span></div></div></div></div></div><p class="detail-description">${escape(p.description)}</p><div class="detail-notes"><div><h3>Composition and allergens</h3><p>${escape(p.ingredients)}</p><p><b>Allergens:</b> ${escape(p.allergens)}</p></div><div><h3>Storage conditions</h3><p>${escape(p.storage)}</p><p>The photograph is illustrative. Composition and packaging may vary.</p></div></div><div class="detail-order">${quantityControl(p.id, ui.detailQuantity, left - (state.cart[p.id] || 0), 'detail')}<button class="button primary" data-action="detail-add" data-id="${escape(p.id)}" ${left <= (state.cart[p.id] || 0) ? 'disabled' : ''}>${icon('bag')}${left ? `Add to cart · ${money(p.price * ui.detailQuantity)}` : 'Sold out'}</button></div>`, 'Demo offer');
}
function renderCart() {
  cleanCart(); const items = cartItems(), t = totals(items);
  modalShell('Your cart', items.length ? `<div class="cart-items">${items.map(({ p, qty }) => `<div class="cart-item"><img src="${escape(productImage(p))}" alt="${escape(p.name)}" /><div><h3>${escape(p.name)}</h3><p>${escape(p.store)}<br>${escape(expiryLabel(p))}</p></div><div><strong class="price">${money(p.price * qty)}</strong>${quantityControl(p.id, qty, available(p))}</div></div>`).join('')}</div><p class="cart-note">${icon('clock')}In the demo, items are not reserved until the order is confirmed. The pickup time is indicated on the card.</p><div class="cart-summary"><div><span>Regular price</span><span>${money(t.original)}</span></div><div class="saving"><span>Your savings</span><strong>−${money(t.original - t.price)}</strong></div><div><span>Rescued food</span><span>≈ ${number(t.weight)} kg</span></div><div class="total"><span>Total</span><strong>${money(t.price)}</strong></div></div><button class="button primary full-width" data-action="checkout">Go to checkout ${icon('arrowRight')}</button><p class="cart-footnote">Demo order. No real payments.</p>` : empty('There’s nothing tasty here yet', 'Select a find from the catalog and add it to your cart.', 'close', 'Shopping'), `${t.count} ${plural(t.count, ['item', 'items'])} · ${state.city}`, true);
}
function checkoutSummary(delivery = false) {
  const t = totals(), fee = delivery ? 700 : 0;
  return `<div><span>Products</span><strong>${money(t.price)}</strong></div><div class="saving"><span>Saving on products</span><strong>${money(t.original - t.price)}</strong></div><div><span>${delivery ? 'Delivery (demo)' : 'Pickup'}</span><span>${fee ? money(fee) : 'Free'}</span></div><div class="total"><span>Total</span><strong>${money(t.price + fee)}</strong></div>`;
}
function renderCheckout() {
  const items = cartItems(); if (!items.length) { ui.modal = 'cart'; return renderCart(); }
  const canDeliver = items.every(({ p }) => p.delivery);
  modalShell('Almost on your desk', `${demoNotice('Demo design: do not enter real personal and banking information. The order will only be saved in this browser.')}<form id="checkout-form" class="form-stack"><fieldset class="choice-group"><legend>How will you receive your order?</legend><div class="radio-options"><label class="radio-option"><input type="radio" name="fulfillment" value="pickup" checked />${icon('store')}<span>Pickup<small>From every store · free</small></span></label><label class="radio-option"><input type="radio" name="fulfillment" value="delivery" ${!canDeliver ? 'disabled' : ''} />${icon('truck')}<span>Delivery<small>${canDeliver ? 'About 45–60 minutes · 700 ₸' : 'Not available on all products'}</small></span></label></div></fieldset><div class="demo-notice" id="pickup-details">${icon('pin')}<span>${[...new Set(items.map(({ p }) => `${p.store}: ${address(p)}, ${p.pickup}`))].map(escape).join('<br>')}<br>Addresses and intervals are for demonstration purposes.</span></div><div id="delivery-address" hidden><label style="display:grid;gap:8px;font-size:11px;font-weight:600">Address for demonstration<input name="address" placeholder="For example: st. Approximate, 10" maxlength="160" /></label><small>Use a fictitious address. The courier service is not connected.</small></div><label>How should I contact you?<input name="name" placeholder="For example: Dana" autocomplete="off" maxlength="50" required /></label><fieldset class="choice-group"><legend>Payment method (layout)</legend><div class="radio-options"><label class="radio-option"><input type="radio" name="payment" value="Kaspi" checked /><span>Kaspi<small>Demonstration</small></span></label><label class="radio-option"><input type="radio" name="payment" value="card" /><span>Bank card<small>Demonstration</small></span></label></div><small>There are no payment forms. No money is written off.</small></fieldset><div id="checkout-summary" class="cart-summary">${checkoutSummary()}</div><label class="check-label"><input type="checkbox" name="demo" required /><span>I understand this is an educational demonstration. The actual order will not be sent to the store.</span></label><p id="checkout-error" class="form-error" hidden></p><button class="button primary full-width" type="submit">Confirm demo order ${icon('arrowRight')}</button><button type="button" class="text-button" data-action="cart">${icon('back')} Return to cart</button></form>`, `${state.city} · discounted products`);
}
function submitOrder(form) {
  const data = new FormData(form), items = cartItems();
  const delivery = data.get('fulfillment') === 'delivery';
  const fail = message => { const el = $('#checkout-error'); el.textContent = message; el.hidden = false; };
  if (!items.length) return fail('The cart is empty. Add products to the catalog.');
  if (!data.get('name')?.trim()) return fail('Provide a name for the demo.');
  if (!data.get('demo')) return fail('Please confirm that you are placing a demo order.');
  if (delivery && !data.get('address')?.trim()) return fail('Please provide an example of your delivery address.');
  if (delivery && items.some(({ p }) => !p.delivery)) return fail('For some products, pick-up only is available.');
  if (items.some(({ p, qty }) => qty > available(p) || daysLeft(p) < 0)) return fail('Availability has changed. Check your cart.');
  const t = totals(items), time = new Date();
  const id = `LS-${time.getTime().toString(36).slice(-5).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const order = { id, buyerId: portalController?.user()?.id || null, createdAt: time.toISOString(), day: dayKey(time), city: state.city, name: data.get('name').trim(), fulfillment: delivery ? 'delivery' : 'pickup', address: delivery ? data.get('address').trim() : '', payment: data.get('payment'), fee: delivery ? 700 : 0, total: t.price + (delivery ? 700 : 0), savings: t.original - t.price, weight: t.weight, status: 'confirmed', items: items.map(({ p, qty }) => ({ id: p.id, ownerId: p.ownerId || null, name: p.name, quantity: qty, price: p.price, original: p.original, weight: p.weight, store: p.store, pickup: p.pickup, address: address(p), image: p.image })) };
  state.orders.unshift(order); state.cart = {}; save(); refresh({ modal: false }); openModal('success', id);
}
function getOrder() { return state.orders.find(o => o.id === ui.modalId); }
function renderSuccess() {
  const o = getOrder(); if (!o) return;
  modalShell('Ready. You gave the food a chance!', `<div class="success-hero"><div class="success-icon">${icon('check')}</div><h3>${escape(o.name)}, delicious food is already waiting</h3><p>The demo order is saved in the history of this browser.<br>${o.fulfillment === 'pickup' ? 'In this service, this code must be shown upon receipt.' : 'In this service, information about the courier will appear here.'}</p></div><div class="order-code"><div><small>Demo order code</small><strong>${escape(o.id)}</strong></div>${icon('bag')}</div><div class="demo-notice">${icon('leaf')}<span>You saved ${money(o.savings)} and chose ≈ ${number(o.weight)} kg of products that could remain unsold.</span></div><div class="cart-summary"><div><span>Method of obtaining</span><strong>${o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery (demo)'}</strong></div><div class="total"><span>Order amount</span><strong>${money(o.total)}</strong></div></div><button class="button primary full-width" data-action="tracking" data-id="${escape(o.id)}">View order ${icon('arrowRight')}</button><p class="cart-footnote">No money has been written off. The store did not receive this order.</p>`);
}
function renderOrders() {
  modalShell('My orders', shopperOrders().length ? `<div class="order-list">${shopperOrders().map(o => `<article class="order-card"><div class="order-top"><h3>${escape(o.id)}</h3><span class="order-status">${o.refunded ? 'Return · demo' : o.status === 'received' ? 'Received · demo' : 'Confirmed · demo'}</span></div><p>${dateText(new Date(o.createdAt))} · ${escape(o.city)} · ${o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}<br>${o.items.map(i => `${escape(i.name)} × ${i.quantity}`).join('<br>')}</p><div class="order-actions"><strong class="price">${money(o.total)}</strong><button class="text-button" data-action="tracking" data-id="${escape(o.id)}">More details ${icon('arrowRight')}</button></div></article>`).join('')}</div>` : empty('The story begins with the first discovery', 'Place a demo order and it will appear here.', 'close', 'Open catalog'), 'Your demo orders are only stored in this browser');
}
function renderTracking() {
  const o = getOrder(); if (!o) return;
  const received = o.status === 'received';
  modalShell(`Order ${o.id}`, `${demoNotice('Demonstration of order statuses. Updates are not associated with a real store or courier.')}<div class="timeline"><div class="timeline-step current"><span class="timeline-marker">${icon('check')}</span><div><strong>Order confirmed</strong><p>${dateText(new Date(o.createdAt))} · ${escape(o.city)}</p></div></div><div class="timeline-step ${received ? 'current' : ''}"><span class="timeline-marker">${icon(o.fulfillment === 'pickup' ? 'store' : 'truck')}</span><div><strong>${o.fulfillment === 'pickup' ? 'Getting ready for pickup' : 'Preparing for delivery'}</strong><p>${o.fulfillment === 'pickup' ? 'Pickup intervals are listed below for each store.' : `Example address: ${escape(o.address)}. Layout guideline: 45–60 minutes.`}</p></div></div><div class="timeline-step ${received ? 'current' : ''}"><span class="timeline-marker">${icon('bag')}</span><div><strong>${received ? 'Bon appetit!' : 'Receiving an order'}</strong><p>${received ? 'You marked the order as received in the demo.' : 'Once received, mark your order using the button below.'}</p></div></div></div><div class="order-code"><div><small>Receipt code (demo)</small><strong>${escape(o.id)}</strong></div>${icon('bag')}</div><div class="order-list">${o.items.map(i => `<div class="order-card"><h3>${escape(i.name)} × ${i.quantity}</h3><p>${escape(i.store)} · ${escape(i.address)}<br>Receipt: ${escape(i.pickup)} · ${money(i.price * i.quantity)}</p></div>`).join('')}</div><div class="cart-summary"><div class="saving"><span>You saved on groceries</span><strong>${money(o.savings)}</strong></div><div class="total"><span>Total${o.fee ? ', with delivery' : ''}</span><strong>${money(o.total)}</strong></div></div>${!received ? `<button class="button primary full-width" data-action="received" data-id="${escape(o.id)}">${icon('check')}Mark received (demo)</button>` : ''}<div class="order-actions"><button class="text-button" data-action="report" data-id="${escape(o.id)}">Report quality</button><button class="text-button" data-action="orders">All orders ${icon('arrowRight')}</button></div>`);
}
function renderReport() {
  const o = getOrder(); if (!o) return;
  const existing = state.reports.find(r => r.orderId === o.id);
  modalShell('Report quality', `${demoNotice('This is the layout of the appeal. Support and sending photos to the server are not connected. The description is saved only in this browser.')}${existing ? `<div class="demo-notice">${icon('check')}<span>This order has already been saved ${dateText(new Date(existing.createdAt))}. You can update the description.</span></div>` : ''}<form id="report-form" class="form-stack"><label>Order<input value="${escape(o.id)}" disabled /></label><label>What was the problem?<select name="reason"><option>Product quality</option><option>Expiration date</option><option>Incomplete order</option><option>Another problem</option></select></label><label>Description<textarea name="description" required minlength="10" maxlength="2000" placeholder="Describe the situation (at least 10 characters)">${escape(existing?.description || '')}</textarea></label><label>Photo (preview, not saved)<input type="file" id="report-photo" accept="image/jpeg,image/png,image/webp" /><small>Image only JPG, PNG or WebP up to 5 MB. After closing the window it will be deleted.</small></label><img id="photo-preview" alt="Preview of the photo for the appeal" hidden style="max-height:200px;object-fit:contain;border-radius:9px" /><button type="submit" class="button primary">Save demo message ${icon('arrowRight')}</button></form>`);
}
function renderImpact() {
  const complete = shopperOrders().filter(o => o.status === 'received');
  const weight = complete.reduce((s, o) => s + o.weight, 0), savings = complete.reduce((s, o) => s + o.savings, 0);
  modalShell('Your little big changes', `<p>Every product on your table is another good story. Only demo orders that you have marked as received are counted here.</p><div class="impact-grid"><div class="impact-tile">${icon('leaf')}<strong>${number(weight)} kg</strong><span>products got a chance</span></div><div class="impact-tile">${icon('wallet')}<strong>${money(savings)}</strong><span>savings on products</span></div><div class="impact-tile">${icon('bag')}<strong>${complete.length}</strong><span>${plural(complete.length, ['received order', 'received orders', 'orders received'])}</span></div></div><p class="impact-explainer">Weight and regular price taken from display cards. Savings do not include shipping. Evaluation CO₂ not shown: it requires a proven calculation method.</p><div class="detail-order"><button class="text-button" data-action="orders">My orders ${icon('arrowRight')}</button><button class="button primary" data-action="share-impact">Copy my result ${icon('leaf')}</button></div>`);
}
function renderMap() {
  const list = filteredProducts();
  modalShell('Delicious food nearby', `${demoNotice('A schematic map shows the search scenario. Markers and distances do not correspond to real geography. The current catalog filters are used.')}${list.length ? `<div class="map-layout"><div class="demo-map"><span class="map-district" style="top:18%;left:14%">YOUR AREA</span><span class="map-district" style="top:75%;left:35%">PARK</span>${list.map((p, i) => `<button class="map-pin ${ui.mapSelection === p.id ? 'active' : ''}" style="left:${Number(p.x) || (20 + i * 7) % 65}%;top:${Number(p.y) || (25 + i * 13) % 65}%" data-action="map-select" data-id="${escape(p.id)}" aria-label="${escape(p.store)}: ${escape(p.name)}, ${money(p.price)}">${money(p.price).replace(' ₸', '')}</button>`).join('')}<span class="map-caption">Diagram for demonstration · ${escape(state.city)}</span></div><div class="map-list">${list.map(p => `<button class="map-store ${ui.mapSelection === p.id ? 'active' : ''}" data-action="product" data-id="${escape(p.id)}"><img src="${escape(productImage(p))}" alt="" /><div><h3>${escape(p.name)}</h3><p>${escape(p.store)}</p><small>${money(p.price)} · −${discount(p)}%</small></div></button>`).join('')}</div></div>` : empty('The map is still empty', 'Remove some of the filters in the catalog to see more finds.')}`);
}
function renderStore() {
  const p = product(ui.modalId); if (!p) return;
  const list = catalogProducts().filter(x => x.store === p.store && inCity(x) && listed(x) && daysLeft(x) >= 0);
  modalShell(p.store, `${demoNotice('Demonstration store. The address and inventory are given as an example.')}<div class="detail-data" style="margin-bottom:22px"><div>${icon('pin')}<div><b>${escape(address(p))}</b><span>Pickup by time from the product card</span></div></div></div><div class="favorite-list">${list.map(productCard).join('')}</div>`, 'Products with another chance');
}
function renderPartner() {
  const listings = state.listings.filter(p => p.city === state.city), orders = state.orders.filter(o => o.items.some(i => i.id.startsWith('custom-')));
  const revenue = orders.reduce((sum, o) => sum + o.items.filter(i => i.id.startsWith('custom-')).reduce((s, i) => s + i.price * i.quantity, 0), 0);
  modalShell('Merchant Portal', `${demoNotice('Demo account without registration. Offers will only appear in this browser’s directory. The finances below are a local order model, payments are not made.')}<div class="stats-grid"><div class="stat-tile"><strong>${listings.length}</strong><span>your suggestions · ${escape(state.city)}</span></div><div class="stat-tile"><strong>${orders.length}</strong><span>demo orders of your products</span></div><div class="stat-tile"><strong>${money(revenue)}</strong><span>cost of goods in demo orders</span></div></div><div class="order-actions"><h3 style="font-size:15px">My suggestions</h3><button class="button primary" data-action="listing">${icon('plus')}Post a product</button></div><div class="partner-tabs"><button class="${ui.partnerTab === 'inventory' ? 'active' : ''}" data-action="partner-tab" data-tab="inventory">Inventory</button><button class="${ui.partnerTab === 'orders' ? 'active' : ''}" data-action="partner-tab" data-tab="orders">Orders</button><button class="${ui.partnerTab === 'impact' ? 'active' : ''}" data-action="partner-tab" data-tab="impact">Contribution</button></div>${ui.partnerTab === 'inventory' ? listings.length ? `<div class="partner-list">${listings.map(p => `<div class="partner-item"><img src="${escape(productImage(p))}" alt="${escape(p.name)}" /><div><h3>${escape(p.name)}</h3><p>${escape(categoryName(p.category))} · Remainder: ${available(p)} · ${daysLeft(p) < 0 ? 'Expired' : escape(expiryLabel(p))}</p></div><strong class="price">${money(p.price)}</strong><button data-action="delete-listing" data-id="${escape(p.id)}" aria-label="Remove offer ${escape(p.name)}">${icon('close')}</button></div>`).join('')}</div>` : empty('Your first offer', 'Place a product with a 40-70% discount or put together a mystery bundle.', 'listing', 'Add an offer') : ui.partnerTab === 'orders' ? orders.length ? `<div class="order-list">${orders.map(o => `<article class="order-card"><h3>${escape(o.id)} · ${escape(o.name)}</h3><p>${o.items.filter(i => i.id.startsWith('custom-')).map(i => `${escape(i.name)} × ${i.quantity}`).join('<br>')}<br>${o.status === 'received' ? 'Received (demo)' : 'Confirmed (demo)'}</p></article>`).join('')}</div>` : empty('No new orders yet', 'Add your item to your cart and place a demo order to test this section.') : `<div class="demo-notice">${icon('leaf')}<span>Demo products in received orders: ${number(orders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.items.filter(i => i.id.startsWith('custom-')).reduce((s, i) => s + i.weight * i.quantity, 0), 0))} kg. This data is not official ESG-report.</span></div><button class="text-button" data-action="donation">Donate leftovers to help ${icon('arrowRight')}</button>`}`, `${state.city} · store in your browser`);
}
function renderListingForm() {
  modalShell('Give products a new chance', `${demoNotice('A local demo offer is created, visible only on this device. Do not provide real personal information.')}<form id="listing-form" class="form-stack"><label>Store name<input name="store" value="My store" required maxlength="45" /></label><label>Name of product or set<input name="name" placeholder="For example: A set of tea buns" required maxlength="65" /></label><div class="form-row"><label>Category<select name="category">${categories.filter(c => c.id !== 'all').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label><label>City<select name="city">${Object.keys(cities).map(c => `<option ${c === state.city ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div><div class="form-row"><label>Regular price, ₸<input name="original" type="number" min="100" max="1000000" step="1" required /></label><label>Discount price, ₸<input name="price" type="number" min="1" max="1000000" step="1" required /><small>In concept LowS Market discounts from 40 to 70%.</small></label></div><div class="form-row"><label>Quantity<input name="stock" type="number" min="1" max="999" step="1" value="5" required /></label><label>Weight per item, kg<input name="weight" type="number" min="0.01" max="100" step="0.01" value="0.5" required /></label></div><div class="form-row"><label>Best before<input name="expiration" type="date" min="${dayKey()}" value="${dayKey(relativeDate(1))}" required /></label><label>Pickup window<select name="pickup"><option>16:00–19:00</option><option>17:00–20:00</option><option>18:00–21:00</option></select></label></div><label>Description and exact composition<textarea name="description" required minlength="10" maxlength="1000" placeholder="What’s included in the offer? For a surprise, indicate possible categories."></textarea></label><label>Allergens<input name="allergens" required maxlength="300" placeholder="For example: gluten, milk, eggs" /></label><label>Storage conditions<input name="storage" required maxlength="300" placeholder="For example: store at +2…+6 °C" /></label><label class="check-label"><input type="checkbox" name="delivery" /><span>Delivery available (demo)</span></label><p id="listing-error" class="form-error" hidden></p><button class="button primary full-width" type="submit">Publish in my demo directory ${icon('arrowRight')}</button><button type="button" class="text-button" data-action="partner">${icon('back')}To the Merchant Portal</button></form>`, 'New demo offer');
}
function submitListing(form) {
  const d = new FormData(form), price = Number(d.get('price')), original = Number(d.get('original')), expiry = d.get('expiration');
  const fail = text => { $('#listing-error').textContent = text; $('#listing-error').hidden = false; };
  if (!price || !original || price / original < .3 - 1e-8 || price / original > .6 + 1e-8) return fail('Specify a discount of 40 to 70% off the regular price. For example, 500 ₸ instead of 1,000 ₸.');
  if (!expiry || expiry < dayKey()) return fail('Enter today’s or future expiration date.');
  for (const field of ['name', 'store', 'description', 'allergens', 'storage']) if (!String(d.get(field)).trim()) return fail('Fill out all text fields.');
  const category = d.get('category'), image = { bakery: 'bakery.jpg', vegetables: 'vegetables.jpg', fruit: 'fruit.jpg', dairy: 'dairy.jpg', meals: 'lunch.jpg', surprise: 'bread.jpg' }[category];
  if (!image || !cities[d.get('city')]) return fail('Select a category and city from the list.');
  state.listings.unshift({ id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: d.get('name').trim(), store: d.get('store').trim(), city: d.get('city'), category, image, price, original, stock: Number(d.get('stock')), weight: Number(d.get('weight')), expiration: expiry, subtitle: `${categoryName(category)} · ${number(Number(d.get('weight')))} kg`, description: d.get('description').trim(), ingredients: d.get('description').trim(), allergens: d.get('allergens').trim(), storage: d.get('storage').trim(), pickup: d.get('pickup'), delivery: d.get('delivery') === 'on', diet: 'all', color: '#dce8cf', tag: 'Demo offer', x: 44, y: 43 });
  save(); refresh({ modal: false }); openModal('partner'); notify('Offer added to local catalog');
}
function renderDonation() {
  modalShell('Share good food', `<p>Donation Hub — part of the concept LowS Market. Stores can offer products for donation, and charities can coordinate collection.</p><div style="margin-top:18px">${demoNotice('This is a help center layout. Real organizations are not connected. Applications remain only in your browser.')}</div><div class="donation-list"><div class="donation-option">${icon('store')}<div><h3>I want to donate products</h3><p>Create a demo application from a store, cafe or bakery.</p></div><button class="button primary" data-action="donation-form" data-type="donor">Suggest</button></div><div class="donation-option">${icon('handHeart')}<div><h3>I represent the organization</h3><p>Check the product request script for assistance.</p></div><button class="button primary" data-action="donation-form" data-type="ngo">Leave a request</button></div></div>${state.donations.length ? `<h3 style="font-size:13px;margin:24px 0 12px">Your local requests</h3><div class="order-list">${state.donations.map(d => `<article class="order-card"><div class="order-top"><h3>${escape(d.organization)}</h3><span class="order-status">Saved · demo</span></div><p>${d.type === 'ngo' ? 'Request help' : 'Product offer'} · ${escape(d.city)}<br>${escape(d.description)}</p></article>`).join('')}</div>` : ''}`);
}
function renderDonationForm() {
  const ngo = ui.modalId === 'ngo';
  modalShell(ngo ? 'Request Products for Help' : 'Offer products for donation', `${demoNotice('Use fictitious data. The application is not sent to organizations or volunteers.')}<form id="donation-form" class="form-stack"><input type="hidden" name="type" value="${ngo ? 'ngo' : 'donor'}" /><label>${ngo ? 'Organization (for example)' : 'Shop or cafe (for example)'}<input name="organization" required maxlength="80" placeholder="Title" /></label><label>City<select name="city">${Object.keys(cities).map(c => `<option ${c === state.city ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>${ngo ? 'What products are needed?' : 'What are you willing to convey?'}<textarea name="description" required minlength="10" maxlength="1000" placeholder="Indicate the composition, quantity and suitable time. To transfer products, also indicate the expiration date and storage conditions."></textarea></label><label class="check-label"><input type="checkbox" required /><span>This is a demonstration application without submission to real organizations.</span></label><button type="submit" class="button primary">Save demo application ${icon('arrowRight')}</button><button type="button" class="text-button" data-action="donation">${icon('back')}Back to Help Center</button></form>`);
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const { action, id } = target.dataset;
  if (action === 'close') closeModal();
  if (['cart', 'city', 'favorites', 'orders', 'impact', 'partner', 'listing', 'about', 'map', 'donation'].includes(action)) openModal(action);
  if (['product', 'tracking', 'report', 'store'].includes(action)) openModal(action, id);
  if (action === 'menu') { const menu = $('#mobile-nav'); menu.hidden = !menu.hidden; target.setAttribute('aria-expanded', String(!menu.hidden)); }
  if (action === 'select-city') {
    const city = target.dataset.city; if (!cities[city]) return;
    if (city !== state.city) { const hadItems = totals().count > 0; state.city = city; state.cart = {}; save(); refresh({ modal: false }); notify(hadItems ? `Selected ${city}. The cart is cleared for the new city.` : `Looking for something tasty: ${city}`); }
    closeModal();
  }
  if (action === 'filters') { const panel = $('#filter-panel'); panel.hidden = !panel.hidden; target.setAttribute('aria-expanded', String(!panel.hidden)); }
  if (action === 'category') { ui.category = target.dataset.category; renderCatalog(); }
  if (action === 'surprise') { resetFilters(); ui.category = 'surprise'; renderCatalog(); $('#catalog').scrollIntoView({ behavior: 'smooth' }); }
  if (action === 'reset-filters') resetFilters();
  if (action === 'favorite') { if (!product(id)) return; state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; save(); refresh(); }
  if (action === 'add') changeQuantity(id, 1);
  if (action === 'minus') changeQuantity(id, -1);
  if (action === 'detail-plus') { const p = product(id); if (p) { ui.detailQuantity = Math.min(ui.detailQuantity + 1, available(p) - (state.cart[id] || 0)); renderModal(); } }
  if (action === 'detail-minus') { ui.detailQuantity = Math.max(1, ui.detailQuantity - 1); renderModal(); }
  if (action === 'detail-add') { const p = product(id); if (!p) return; const qty = (state.cart[id] || 0) + ui.detailQuantity; if (qty > available(p)) return notify('No longer available'); state.cart[id] = qty; save(); refresh(); notify(`${p.name} — in cart`); }
  if (action === 'checkout') openModal('checkout');
  if (action === 'received') { const o = state.orders.find(o => o.id === id); if (o) { o.status = 'received'; save(); renderTracking(); notify('The demo order is marked received. Your contribution has been updated.'); } }
  if (action === 'map-select') { ui.mapSelection = id; renderModal(); const match = $(`.map-store[data-id="${id}"]`); match?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  if (action === 'partner-tab') { ui.partnerTab = target.dataset.tab; renderModal(); }
  if (action === 'delete-listing') { state.listings = state.listings.filter(p => p.id !== id); delete state.cart[id]; state.favorites = state.favorites.filter(x => x !== id); save(); refresh(); notify('Demo offer removed from the catalog'); }
  if (action === 'donation-form') openModal('donation-form', target.dataset.type);
  if (action === 'share-impact') {
    const orders = state.orders.filter(o => o.status === 'received');
    const text = `My demo result LowS Market: ${number(orders.reduce((s, o) => s + o.weight, 0))} kg of products and ${money(orders.reduce((s, o) => s + o.savings, 0))} savings. Good food deserves a chance!`;
    try { await navigator.clipboard.writeText(text); notify('Result copied'); } catch { modalShell('Your result', `<p>${escape(text)}</p><p style="margin-top:15px">Select the text and copy it manually.</p><button class="text-button" style="margin-top:20px" data-action="impact">${icon('back')}Back</button>`); }
  }
});
document.addEventListener('click', event => { if (event.target.closest('.mobile-nav a,.mobile-nav button')) { $('#mobile-nav').hidden = true; $('[data-action="menu"]').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[role="button"][data-action]')) { event.preventDefault(); event.target.click(); }
  if (event.key === '/' && !dialog.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
});
$('#search').addEventListener('input', event => { ui.search = event.target.value; renderCatalog(); });
$('#sort').addEventListener('change', event => { ui.sort = event.target.value; renderCatalog(); });
$('#max-price').addEventListener('input', event => { ui.maxPrice = event.target.value; renderCatalog(); });
$('#diet').addEventListener('change', event => { ui.diet = event.target.value; renderCatalog(); });
$('#expiry').addEventListener('change', event => { ui.expiry = event.target.value; renderCatalog(); });
$('#delivery-filter').addEventListener('change', event => { ui.delivery = event.target.checked; renderCatalog(); });
document.addEventListener('change', event => {
  if (event.target.matches('[name="fulfillment"]')) { const delivery = event.target.value === 'delivery'; $('#delivery-address').hidden = !delivery; $('#delivery-address input').required = delivery; $('#pickup-details').hidden = delivery; $('#checkout-summary').innerHTML = checkoutSummary(delivery); }
  if (event.target.id === 'report-photo') {
    const file = event.target.files[0], preview = $('#photo-preview'); preview.hidden = true;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { event.target.value = ''; return notify('Select JPG, PNG or WebP up to 5 MB in size.'); }
    const reader = new FileReader(); reader.onload = () => { if ($('#photo-preview')) { $('#photo-preview').src = reader.result; $('#photo-preview').hidden = false; } }; reader.readAsDataURL(file);
  }
});
document.addEventListener('submit', event => {
  const form = event.target; if (!['checkout-form', 'listing-form', 'donation-form', 'report-form'].includes(form.id)) return;
  event.preventDefault(); if (!form.reportValidity()) return;
  if (form.id === 'checkout-form') submitOrder(form);
  if (form.id === 'listing-form') submitListing(form);
  if (form.id === 'report-form') {
    const d = new FormData(form), description = d.get('description').trim(); if (description.length < 10) return notify('Describe the problem in more detail: at least 10 characters.');
    state.reports = state.reports.filter(r => r.orderId !== ui.modalId);
    state.reports.push({ id: `R-${Date.now()}`, status: 'pending', userId: portalController?.user()?.id || null, orderId: ui.modalId, reason: d.get('reason'), description, createdAt: new Date().toISOString() });
    save(); openModal('tracking', ui.modalId); notify('The case has been saved locally. There was no support message.');
  }
  if (form.id === 'donation-form') {
    const d = new FormData(form); if (!d.get('organization').trim() || d.get('description').trim().length < 10) return notify('Fill out the title and description of the application.');
    state.donations.unshift({ id: `D-${Date.now()}`, type: d.get('type'), organization: d.get('organization').trim(), description: d.get('description').trim(), city: d.get('city'), createdAt: new Date().toISOString() }); save(); openModal('donation'); notify('Demo application saved in this browser');
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { cleanCart(); refresh({ modal: false }); } });
$$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
$('#year').textContent = new Date().getFullYear();
refresh({ modal: false });

portalController = initPortals({ state, save, refresh, notify, icon, escape, money, number, categories, cities, seedProducts, product, available, daysLeft, dayKey, relativeDate, openModal, closeModal, modalShell, dialog, productImage, demoNotice });

initAssistant({ state, icon, escape, money, number, productImage, product, available, daysLeft, listed, inCity, catalogProducts, save, refresh, notify, changeQuantity, openModal, portals: portalController });
