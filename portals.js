import { migrateLegacyData } from './data.js';
// Local role-based interface. This is a demonstrator, not a security boundary.
export function initPortals(ctx) {
  const { state, save, refresh, notify, icon, escape: esc, money, number, categories, cities, seedProducts, product, available, daysLeft, dayKey, relativeDate, openModal, closeModal, modalShell, dialog, productImage, demoNotice } = ctx;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const key = 'lows-market-portals-v1';
  const roles = {
    buyer: { label: 'Buyer', title: 'Delicious food nearby', icon: 'bag', color: 'green' },
    merchant: { label: 'Store', title: 'Merchant Portal', icon: 'store', color: 'amber', tabs: [['overview','Overview','grid'],['listing','Add product','plus'],['bundles','Mystery Bundles','gift'],['inventory','Inventory','bag'],['orders','Orders & Pickup','truck'],['donations','Donations','handHeart'],['reports','ESG & Tax Reports','leaf'],['payouts','Payments','wallet']] },
    ngo: { label: 'Charity', short: 'NPO', title: 'Charity Portal', icon: 'handHeart', color: 'terracotta', tabs: [['verification','NPO Registration','store'],['available','Available Donations','bag'],['pickups','Claims & Pickup','truck'],['receipts','Donation Receipts','checkCircle'],['impact','Impact Report','leaf']] },
    admin: { label: 'Administrator', title: 'Admin Panel', icon: 'sliders', color: 'slate', tabs: [['overview','Overview','grid'],['moderation','Moderation Queue','info'],['vetting','Partner Vetting','checkCircle'],['rules','Category Rules','sliders'],['users','Users & Roles','store'],['analytics','Analytics & Security Logs','chart']] },
  };
  const demoAccounts = [
    { id:'demo-buyer', name:'Dana', role:'buyer', email:'buyer@demo.lows.example', city:'Almaty', organization:'', verification:'verified', demo:true },
    { id:'demo-merchant', name:'Aliya', role:'merchant', email:'merchant@demo.lows.example', city:'Almaty', organization:'Good Morning Bakery', verification:'verified', demo:true },
    { id:'demo-ngo', name:'Timur', role:'ngo', email:'ngo@demo.lows.example', city:'Almaty', organization:'Warm Table Foundation', verification:'verified', demo:true },
    { id:'demo-admin', name:'Team LowS', role:'admin', email:'admin@demo.lows.example', city:'Almaty', organization:'LowS Market', verification:'verified', demo:true },
  ];
  let db = { accounts: demoAccounts.map(x => ({...x})), session: null, logs: [], claims: [], lots: [], cases: [], orderStates: {}, initialized: false };
  try {
    const saved = migrateLegacyData(JSON.parse(localStorage.getItem(key)));
    if (saved && Array.isArray(saved.accounts) && saved.accounts.every(u => u && typeof u.id === 'string' && typeof u.name === 'string' && typeof u.email === 'string' && roles[u.role])) {
      db = {...db, ...saved};
      for (const array of ['logs','claims','lots','cases']) if (!Array.isArray(db[array])) db[array] = [];
      if (!db.orderStates || typeof db.orderStates !== 'object') db.orderStates = {};
      for (const u of demoAccounts) if (!db.accounts.some(a => a.id === u.id)) db.accounts.push({...u});
    }
  } catch { /* Empty demo state is valid. */ }
  let view = 'buyer', tab = 'overview', authMode = 'login', authRole = 'buyer', afterAuth = null, pendingAdmin = null, editId = null, search = '', period = 'all', donationMode = 'list';
  let authBusy = false, photoData = null;
  const user = () => db.accounts.find(a => a.id === db.session && !a.suspended) || null;
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(db)); } catch { notify('Local storage is full or disabled. Changes are available until reboot.'); } };
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const log = (action, subject = '', outcome = 'Successfully') => { db.logs.unshift({ id:uid('log'), at:new Date().toISOString(), actor:user()?.name || 'Guest', action, subject, outcome }); db.logs = db.logs.slice(0,200); persist(); };
  const date = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-US',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d); };
  const badge = (text, style='neutral') => `<span class="p-badge ${style}">${esc(text)}</span>`;
  const action = (text, name, id='', style='secondary', extra='') => `<button class="p-button ${style}" data-portal="${name}" ${id ? `data-id="${esc(id)}"` : ''} ${extra}>${text}</button>`;
  const blank = (title, text, button='') => `<div class="p-empty">${icon('sprout')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${button}</div>`;
  const card = (title, content, aside='') => `<section class="p-card"><div class="p-card-heading"><h3>${title}</h3>${aside}</div>${content}</section>`;
  const stats = items => `<div class="p-stats">${items.map(([label,value,glyph,note])=>`<article class="p-stat"><span class="p-stat-icon">${icon(glyph)}</span><span>${label}</span><strong>${value}</strong><small>${note || 'Data from this demo'}</small></article>`).join('')}</div>`;
  const table = (heads, rows) => `<div class="p-table-scroll"><table class="p-table"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const field = (label, html) => `<label>${label}${html}</label>`;
  const options = (array, selected) => array.map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');
  const myListings = () => state.listings.filter(p=>p.ownerId===user()?.id);
  const merchantOrders = () => state.orders.filter(o=>o.items.some(i=>myListings().some(p=>p.id===i.id)));
  const myClaims = () => db.claims.filter(c=>c.ngoId===user()?.id);
  const verified = () => user()?.verification === 'verified';
  const mySales = () => merchantOrders().filter(o=>!o.refunded).reduce((s,o)=>s+o.items.filter(i=>myListings().some(p=>p.id===i.id)).reduce((n,i)=>n+i.price*i.quantity,0),0);
  function seedDemo() {
    if (db.initialized) return;
    db.lots = [
      {id:'lot-bread',name:'Bread and buns from the bakery',store:'Good Morning Bakery',ownerId:'demo-merchant',city:'Almaty',stock:8,weight:.6,image:'bread.jpg',expires:dayKey(relativeDate(1)),pickup:'18:00–20:00',allergens:'Gluten, milk, eggs',storage:'In a cool dry place',address:'Demo: 56 Abay Street',example:true},
      {id:'lot-vegetables',name:'Seasonal vegetables to help',store:'Green Grocer (example)',ownerId:'sample-store',city:'Almaty',stock:12,weight:1.5,image:'vegetables.jpg',expires:dayKey(relativeDate(2)),pickup:'16:00–19:00',allergens:'Please check the ingredients upon receipt.',storage:'Store at +2…+6 °C',address:'Demo: 24 Zhandosov Street',example:true},
      {id:'lot-fruit',name:'Fruits for a healthy snack',store:'City shop (example)',ownerId:'sample-store',city:'Astana',stock:6,weight:1,image:'fruit.jpg',expires:dayKey(relativeDate(2)),pickup:'17:00–20:00',allergens:'Citrus',storage:'Store in a cool place',address:'Demo: 12 Kunayev Street',example:true},
    ];
    db.accounts.push({id:'sample-ngo',role:'ngo',name:'Fund representative',organization:'Fund “Together“ (example)',email:'review@demo.lows.example',city:'Shymkent',verification:'pending',documents:['Charter of the organization.pdf'],demo:true,reviewOnly:true});
    db.cases = [{id:'case-example',orderId:'EXAMPLE-01',reason:'Product quality',description:'Example: a customer reports damaged packaging. Check the request processing script.',productId:'croissants',status:'pending',createdAt:new Date().toISOString(),example:true}];
    db.initialized=true; persist();
  }
  seedDemo();
  function seedMerchant() {
    if (user()?.id !== 'demo-merchant' || db.merchantSeeded) return;
    for (const [i,p] of [seedProducts[0],seedProducts[2],seedProducts[6]].entries()) state.listings.push({...p,id:`custom-${Date.now()+i}-demo`,ownerId:'demo-merchant',blocked:false,paused:false,pending:false,store:user().organization,city:'Almaty',expiration:dayKey(relativeDate(i===0?1:2)),tag:'Store demo',createdAt:new Date().toISOString()});
    db.merchantSeeded=true; save(); persist(); refresh({modal:false});
  }
  function updateHeader() {
    const u=user(), nav=$('#role-navigation');
    nav.innerHTML=`<div class="role-navigation-inner"><span class="role-nav-caption">LOW S · SPACES</span>${Object.entries(roles).map(([id,r])=>`<a href="${id==='buyer'?'#catalog':`#portal/${id}/${r.tabs[0][0]}`}" class="role-nav-link ${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(r.icon)}<span>${r.short||r.label}</span>${id!=='buyer'?'<span class="role-nav-demo">DEMO</span>':''}</a>`).join('')}</div>`;
    const account=$('#account-button');
    account.innerHTML=`<span class="account-avatar">${u?esc(u.name.slice(0,1).toUpperCase()):icon('arrowRight')}</span><span class="account-label">${u?esc(u.name.split(' ')[0]):'Login / Registration'}</span>`;
    account.setAttribute('aria-label',u?`Profile: ${u.name}`:'Login and registration');
    document.body.classList.toggle('portal-mode',view!=='buyer');
    $('#main').hidden=view!=='buyer'; $('.site-footer').hidden=view!=='buyer'; $('#role-portal').hidden=view==='buyer';
    window.dispatchEvent(new CustomEvent('lows:role-changed'));
  }
  function go(role, nextTab) {
    const hash=role==='buyer'?'#catalog':`#portal/${role}/${nextTab||roles[role]?.tabs[0][0]}`;
    if (location.hash===hash) route(); else location.hash=hash;
  }
  function route() {
    const match=location.hash.match(/^#portal\/(merchant|ngo|admin)(?:\/([a-z]+))?$/);
    view=match?match[1]:'buyer';
    tab=match&&roles[view].tabs.some(t=>t[0]===match[2])?match[2]:(roles[view].tabs?.[0][0]||'overview');
    updateHeader(); if(view!=='buyer') { renderPortal(); window.scrollTo({top:0,behavior:'instant'}); }
  }
  function renderPortal() {
    const focused=document.activeElement, hadFocus=$('#role-portal').contains(focused);
    const focusKey=hadFocus&&(focused.dataset.portal||focused.getAttribute('href')||focused.id)?{action:focused.dataset.portal,id:focused.dataset.id,href:focused.getAttribute('href'),elementId:focused.id}:null;
    const r=roles[view], u=user(), permitted=u?.role===view;
    const heading=r.tabs.find(t=>t[0]===tab)?.[1]||r.title;
    $('#role-portal').innerHTML=`<div class="p-shell ${r.color}"><aside class="p-sidebar"><div class="p-workspace-mark">${icon(r.icon)}</div><div class="eyebrow">${view==='merchant'?'MERCHANT PORTAL':view==='ngo'?'CHARITY PORTAL':'ADMIN PANEL'}</div><h2>${view==='ngo'?'Charity Portal':r.title}</h2><p class="p-organization">${permitted?esc(u.organization||u.name):'Separate space for your role'}</p><nav aria-label="Portal tabs">${r.tabs.map(([id,name,glyph],i)=>`<a href="#portal/${view}/${id}" class="p-sidebar-link ${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}><span>${icon(glyph)}</span>${name}<small>${String(i+1).padStart(2,'0')}</small></a>`).join('')}</nav><div class="p-sidebar-bottom">${icon('info')}<span>Training prototype<br>Data on this device</span></div></aside><div class="p-content"><header class="p-page-header"><div><div class="eyebrow muted">LOWS MARKET / ${view==='merchant'?'FOR BUSINESS':view==='ngo'?'HELPING THE COMMUNITY':'MANAGEMENT'}</div><h1>${heading}</h1><p>${view==='merchant'?'Fewer write-offs. More possibilities.':view==='ngo'?'Good food where you need it.':'All project processes in one space.'}</p></div><div class="p-page-user">${badge('Demo mode','neutral')}${permitted?action(`${icon('store')} ${esc(u.name)}`,'account'):action('Login to your account','auth',view,'primary')}</div></header><div id="portal-content">${permitted?'':accessScreen()}</div><p class="p-footer-note">LowS Market · Prototype interface. Actions are saved in the browser. Payments, due diligence and access protection are not enabled on the server.</p></div></div>`;
    if (permitted) {
      let content='';
      if(view==='merchant') content=renderMerchant();
      if(view==='ngo') content=renderNGO();
      if(view==='admin') content=renderAdmin();
      $('#portal-content').innerHTML=content;
      if(!verified()&&view!=='admin') $('#portal-content').insertAdjacentHTML('afterbegin',`<div class="p-notice warning">${icon('info')}<div><strong>Organization awaiting verification</strong><p>The administrator can approve the application in the “Partner Vetting“ tab. ${view==='merchant'?'For now, you can create draft listings.':'Reservations will become available once approved.'}</p></div></div>`);
    }
    const navigation=$('.p-sidebar>nav'), activeLink=$('.p-sidebar-link.active');
    if(navigation&&activeLink&&navigation.scrollWidth>navigation.clientWidth) navigation.scrollLeft=Math.max(0,activeLink.offsetLeft-navigation.offsetLeft-18);
    if(focusKey){
      const replacement=$$('button,a,input,select',$('#role-portal')).find(el=>focusKey.elementId?el.id===focusKey.elementId:focusKey.href?el.getAttribute('href')===focusKey.href:el.dataset.portal===focusKey.action&&el.dataset.id===focusKey.id);
      if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
    }
    window.dispatchEvent(new CustomEvent('lows:portal-rendered'));
  }

  function accessScreen() {
    const current=user();
    return `<section class="p-access"><span class="p-access-icon">${icon(roles[view].icon)}</span><span class="eyebrow">YOUR SPACE IN LOW S</span><h2>${roles[view].title}</h2><p>${current?`You are now logged in with a role «${roles[current.role].label}». This account requires a separate profile.`:'Register or log in with the appropriate role. Each role has its own tools and tabs.'}</p><div>${action('Register','signup',view,'primary')}${action('I have an account','auth',view)}</div><div class="p-demo-entry"><span>Just look at the interface?</span>${action(`Open demo: ${roles[view].short||roles[view].label} ${icon('arrowRight')}`,'demo',view)}</div></section>`;
  }
  function showDialog(title, body, subtitle='') {
    // Core modal handles Escape, focus, backdrop and body scrolling.
    openModal('portal'); modalShell(title,body,subtitle);
    $('.dialog-header [data-action="close"]')?.focus({preventScroll:true});
  }
  function showAuth(mode='login', role='buyer') {
    authMode=mode; authRole=roles[role]?role:'buyer';
    const signup=mode==='signup';
    showDialog(signup?'Nice to meet you!':'Welcome back!',`<div class="auth-layout"><div class="auth-intro"><span class="p-access-icon">${icon('sprout')}</span><div class="eyebrow">GOOD FOOD UNITES</div><h3>One project.<br>Four ways<br>do more.</h3><p>Buy profitably, develop a store, help people or manage a platform.</p><div class="auth-demo-note">${icon('info')}<span>Demonstration registration. Use fictitious data and a separate test password.</span></div></div><div class="auth-form-side"><div class="auth-tabs">${action('Login','auth-tab','login',!signup?'active':'')}${action('Registration','auth-tab','signup',signup?'active':'')}</div><form id="role-auth-form" class="form-stack" data-mode="${mode}"><label>I want ${signup?'register':'login'} how<select id="auth-role" name="role">${options(Object.entries(roles).map(([id,r])=>[id,r.label]),authRole)}</select></label>${signup?`${field('Your name','<input name="displayName" required maxlength="60" autocomplete="off" placeholder="For example: Dana" />')}<div id="auth-org-fields" ${['merchant','ngo'].includes(authRole)?'':'hidden'}>${field('Organization name','<input name="organization" maxlength="90" placeholder="Store or charity" />')}<label class="p-document-field">Organization document (layout)<input name="documents" type="file" accept=".pdf,image/jpeg,image/png" multiple /><small>Only file names are saved locally. Do not upload real documents.</small></label></div>`:''}${field('Email for demo','<input type="email" name="email" required maxlength="120" autocomplete="off" placeholder="name@example.com" />')}${field('Test password',`<input type="password" name="password" required minlength="8" maxlength="100" autocomplete="${signup?'new-password':'current-password'}" placeholder="At least 8 characters" />`)}${signup?`${field('Repeat password','<input type="password" name="confirmPassword" required minlength="8" maxlength="100" autocomplete="new-password" />')}<label class="check-label"><input type="checkbox" name="demoConsent" required /><span>I’m creating a demo profile. The data is stored only in this browser.</span></label>`:''}<div class="p-notice compact" id="admin-auth-note" ${authRole==='admin'?'':'hidden'}>${icon('info')}<span>The administrator is available for demonstration. Two-step sign-in uses open test code, there is no real access protection.</span></div><p id="auth-error" class="form-error" hidden></p><button class="button primary full-width" type="submit">${signup?'Create a demo profile':'Login'} ${icon('arrowRight')}</button></form></div></div><div class="auth-quick"><span>Quick view without filling out the form</span><div>${Object.entries(roles).map(([id,r])=>action(`${icon(r.icon)}${r.short||r.label}`,'demo',id)).join('')}</div><small>Demo accounts: <b>role@demo.lows.example</b> (buyer, merchant, ngo, admin), password <b>Demo1234</b>.</small></div>`);
    syncAuthFields();
  }
  function syncAuthFields() {
    const role=$('#auth-role')?.value||authRole; authRole=role;
    const org=$('#auth-org-fields'); if(org){org.hidden=!['merchant','ngo'].includes(role);$('input[name="organization"]',org).required=!org.hidden;}
    if($('#admin-auth-note')) $('#admin-auth-note').hidden=role!=='admin';
  }
  async function passwordHash(password,salt) {
    if(!globalThis.crypto?.subtle) throw new Error('To register you need HTTPS or localhost. You can open a quick demo profile.');
    const input=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},input,256);
    return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function finishLogin(account) {
    db.session=account.id; persist(); log('Portal login',roles[account.role].label); seedMerchant(); closeModal();
    const next=afterAuth; afterAuth=null;
    if(next&&account.role==='buyer') {go('buyer');next();} else go(account.role);
    updateHeader(); refresh({modal:false}); notify(`You are logged in: ${roles[account.role].label}`);
  }
  function challengeAdmin(account) {
    pendingAdmin=account.id;
    showDialog('Administrator Login · step 2',`${demoNotice('Two-factor login layout. Test code is open: 123456. Real OTP and server verification are not connected.')}<form id="admin-code-form" class="form-stack">${field('Demo code','<input name="code" required pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="off" placeholder="123456" />')}<p id="auth-error" class="form-error" hidden></p><button type="submit" class="button primary">Open panel ${icon('arrowRight')}</button></form>`,'Demo verification only');
  }
  function demoLogin(role) {
    const account=db.accounts.find(a=>a.id===`demo-${role}`); if(!account||account.suspended) return notify('This demo profile has been suspended by the administrator.');
    if(role==='admin') challengeAdmin(account);else finishLogin(account);
  }
  function showAccount() {
    const u=user();if(!u)return showAuth();
    showDialog('Your profile',`<div class="profile-summary"><span class="profile-avatar">${esc(u.name.slice(0,1))}</span><div><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p>${badge(roles[u.role].label,'success')}</div></div><form id="profile-form" class="form-stack">${field('Name',`<input name="displayName" value="${esc(u.name)}" required maxlength="60" />`)}${['merchant','ngo'].includes(u.role)?field('Organization',`<input name="organization" value="${esc(u.organization||'')}" required maxlength="90" />`):''}${field('City',`<select name="city">${options(Object.keys(cities).map(c=>[c,c]),u.city)}</select>`)}<button class="button primary" type="submit">Save profile</button></form><div class="p-profile-links">${action('Open my account','my-portal')}${action('Change demo profile','auth','buyer')}${action('Log out of your account','logout','','danger')}</div>`, 'Local demo account');
  }
  function allowed(role) {if(user()?.role===role)return true;showAuth('login',role);return false;}

  function renderMerchant() {
    const items=myListings(), orders=merchantOrders();
    if(tab==='overview') return `${stats([['Sales',money(mySales()),'wallet','Cost of goods in local orders'],['Active offers',items.filter(p=>!p.paused&&!p.blocked&&!p.pending&&daysLeft(p)>=0&&available(p)>0).length,'bag','Without expired or suspended'],['Orders',orders.length,'truck'],['Transferred to help',`${number(db.claims.filter(c=>c.status==='received'&&db.lots.find(l=>l.id===c.lotId)?.ownerId===user().id).reduce((s,c)=>s+c.weight*c.qty,0))} kg`,'leaf']])}<div class="p-two-columns">${card('Today is a good day for good food',`<div class="p-welcome"><span class="p-welcome-icon">${icon('store')}</span><h2>Hello, ${esc(user().name)}!</h2><p>Manage today’s surplus, create a mystery bundle, or donate food to the community.</p><div>${action(`${icon('plus')}Add product`,'nav','listing','primary')}${action('Create a bundle','nav','bundles')}</div></div>`)}${card('What needs attention',`<div class="p-task-list"><a href="#portal/merchant/orders">${icon('truck')}<span>Orders for pickup</span><b>${orders.filter(o=>db.orderStates[`${user().id}:${o.id}`]!=='handed').length}</b></a><a href="#portal/merchant/inventory">${icon('clock')}<span>Expires today</span><b>${items.filter(p=>daysLeft(p)===0).length}</b></a><a href="#portal/merchant/donations">${icon('handHeart')}<span>Donation claims</span><b>${db.claims.filter(c=>c.status==='reserved'&&db.lots.find(l=>l.id===c.lotId)?.ownerId===user().id).length}</b></a></div>`)} </div>${card('Latest offers',inventoryTable(items.slice(0,4)),action('View all inventory →','nav','inventory'))}`;
    if(tab==='listing') return listingForm(false);
    if(tab==='bundles') return `${card('A surprise with a clear benefit',`<p class="p-description">Bundle your surplus food. The buyer will see the minimum regular price, category and possible allergens, but the exact composition will remain a surprise.</p>`)}${listingForm(true)}`;
    if(tab==='inventory') return card('Store inventory',`<div class="p-toolbar"><label class="p-search">${icon('search')}<input id="inventory-search" type="search" value="${esc(search)}" placeholder="Search your listings" aria-label="Search inventory" /></label>${action(`${icon('plus')}Add`,'nav','listing','primary')}</div><div id="inventory-table">${inventoryTable(items.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())))}</div><p class="p-caption">After the expiration date, products are automatically hidden from the catalog. Stopping and blocking also removes the product from sale.</p>`);
    if(tab==='orders') return card('Orders and pickup',orders.length?table(['Order / buyer','Your products','Cost','Status','Actions'],orders.map(o=>{const own=o.items.filter(i=>items.some(p=>p.id===i.id)),status=db.orderStates[`${user().id}:${o.id}`]||'new';return `<tr><td><strong>${esc(o.id)}</strong><small>${esc(o.name)} · ${date(o.createdAt)}</small></td><td>${own.map(i=>`${esc(i.name)} × ${i.quantity}`).join('<br>')}</td><td>${money(own.reduce((s,i)=>s+i.price*i.quantity,0))}</td><td>${badge(status==='handed'?'Issued':status==='ready'?'Ready for pickup':'New',status==='handed'?'success':'warning')}</td><td><div class="p-row-actions">${status==='new'?action('Confirm','merchant-ready',o.id):''}${status!=='handed'?action('Issue by code','merchant-pickup',o.id,'primary'):''}</div></td></tr>`;})):blank('New order - new opportunity','Orders appear here when a buyer checks out your products. Enter the pickup code to simulate a QR scan.'));
    if(tab==='donations') return `${card('Donate food to help',items.filter(p=>available(p)>0&&daysLeft(p)>=0&&!p.blocked).length?`<form id="merchant-donation-form" class="p-form p-inline-form">${field('Your listing',`<select name="listing">${options(items.filter(p=>available(p)>0&&daysLeft(p)>=0&&!p.blocked).map(p=>[p.id,`${p.name} · remainder ${available(p)}`]))}</select>`)}${field('Quantity','<input name="qty" type="number" min="1" step="1" value="1" required />')}<button class="p-button primary" type="submit">${icon('handHeart')}Transfer to the help center</button></form><p class="p-caption">These units leave your sales inventory and become a free donation for NPOs.</p>`:blank('Add Products First','Donate available stock from your inventory.',action('Add product','nav','listing','primary')))}${card('Your free offers',lotTable(db.lots.filter(l=>l.ownerId===user().id)))}${card('NPO pickups',claimTable(db.claims.filter(c=>db.lots.find(l=>l.id===c.lotId)?.ownerId===user().id),true))}`;
    if(tab==='reports') {
      const savedKg=orders.filter(o=>o.status==='received').reduce((s,o)=>s+o.items.filter(i=>items.some(p=>p.id===i.id)).reduce((n,i)=>n+i.weight*i.quantity,0),0), donated=db.claims.filter(c=>c.status==='received'&&db.lots.find(l=>l.id===c.lotId)?.ownerId===user().id).reduce((s,c)=>s+c.qty*c.weight,0);
      return `${stats([['Sold and received',`${number(savedKg)} kg`,'bag'],['Transferred to NPO',`${number(donated)} kg`,'handHeart'],['Revenue from orders',money(mySales()),'wallet']])}${card('ESG and documents',`<div class="p-report-preview"><span>${icon('leaf')}</span><div><h3>Report on products that received a chance</h3><p>Exports include sales and transfers to NPOs from this prototype. CO₂ cannot be calculated without a proven methodology.</p></div>${action('Download CSV','merchant-report','','primary')}</div><div class="p-notice warning">${icon('info')}<span>Forms CIT, VAT and tax write-offs are presented as a project scenario. Export is not a tax document.</span></div>`)}`;
    }
    if(tab==='payouts') {const gross=mySales(), commission=Math.round(gross*.1);return `${stats([['Cost of goods',money(gross),'wallet'],['Commission · example 10%',money(commission),'tag','Conditional rate for demonstration'],['To transfer · layout',money(gross-commission),'chart','There are no real translations']])}${card('Accrual history',orders.length?table(['Order','Cost','Commission · demo','To transfer','Status'],orders.map(o=>{const value=o.items.filter(i=>items.some(p=>p.id===i.id)).reduce((s,i)=>s+i.price*i.quantity,0);return `<tr><td>${esc(o.id)}</td><td>${money(value)}</td><td>${money(o.refunded?0:Math.round(value*.1))}</td><td>${money(o.refunded?0:value-Math.round(value*.1))}</td><td>${badge(o.refunded?'Return · demo':'Calculation · demo')}</td></tr>`;})):blank('No accruals yet','Place an order for store goods as a buyer. The calculation of the conditional commission will appear here.'))}`;}
    return '';
  }
  function inventoryTable(items) {
    return items.length?table(['Offer','Price','Stock','Use-by / status','Management'],items.map(p=>`<tr><td><div class="p-product-cell"><img src="${esc(productImage(p))}" alt="" /><div><strong>${esc(p.name)}</strong><small>${esc(p.city)} · ${p.category==='surprise'?'Mystery Bundle':esc(categories.find(c=>c.id===p.category)?.name)}</small></div></div></td><td><strong>${money(p.price)}</strong><small class="p-strike">${money(p.original)}</small></td><td>${available(p)} pcs.</td><td><small>${esc(p.expiration)}</small>${badge(p.blocked?'Blocked':p.pending?'Under review':daysLeft(p)<0?'Expired':p.paused?'On pause':available(p)===0?'Out of stock':'Active',p.blocked?'danger':p.pending||p.paused?'warning':daysLeft(p)<0?'neutral':'success')}</td><td><div class="p-row-actions">${action('Edit','edit-listing',p.id)}${action(p.paused?'Resume':'Pause','pause-listing',p.id,'secondary',p.blocked||daysLeft(p)<0?'disabled':'')}</div></td></tr>`)):blank('No offers yet','Add a product or surprise package. Customers can see it after an administrator approves your store.',action('Add an offer','nav','listing','primary'));
  }
  function listingForm(bundle) {
    const p=editId?myListings().find(p=>p.id===editId):null;
    const isBundle=bundle||p?.category==='surprise';
    return card(p?'Change offer':isBundle?'New mystery bundle':'New offer',`<form id="portal-listing-form" class="p-form" data-edit="${esc(p?.id||'')}" data-bundle="${isBundle}"><div class="p-form-grid">${field('Title',`<input name="name" required maxlength="65" value="${esc(p?.name||'')}" placeholder="${isBundle?'For example: Evening set from the bakery':'For example: Croissants, 4 pcs.'}" />`)}${field('Category',`<select name="category">${options(categories.filter(c=>c.id!=='all'&&(!isBundle||c.id==='surprise')).map(c=>[c.id,c.name]),p?.category||(isBundle?'surprise':'bakery'))}</select>`)}${field('Regular price, ₸',`<input name="original" type="number" min="100" max="1000000" step="1" value="${p?.original||''}" required />`)}${field('Discount price, ₸',`<input name="price" type="number" min="1" max="1000000" step="1" value="${p?.price||''}" required /><small>Discount from 40 to 70%.</small>`)}${field('Available stock, units',`<input name="stock" type="number" min="${p?'0':'1'}" max="999" step="1" value="${p?available(p):5}" required />`)}${field('Weight per item, kg',`<input name="weight" type="number" min="0.01" max="100" step="0.01" value="${p?.weight||.5}" required />`)}${field('Best before',`<input name="expiration" type="date" min="${dayKey()}" value="${p?.expiration||dayKey(relativeDate(1))}" required />`)}${field('Pickup window',`<select name="pickup">${options(['16:00–19:00','17:00–20:00','18:00–21:00'].map(x=>[x,x]),p?.pickup)}</select>`)}</div>${field(isBundle?'Possible composition of the set':'Description and exact composition',`<textarea name="description" required minlength="10" maxlength="1000" placeholder="Specify the composition and size of the offer">${esc(p?.description||'')}</textarea>`)}<div class="p-form-grid">${field('Allergens',`<input name="allergens" required maxlength="300" value="${esc(p?.allergens||'')}" placeholder="Gluten, milk, eggs..." />`)}${field('Storage conditions',`<input name="storage" required maxlength="300" value="${esc(p?.storage||'')}" placeholder="At +2…+6 °C" />`)}</div>${field('Photo (optional)','<input id="listing-photo" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG, WebP up to 400 KB. The photo is saved on this device.</small>')}<img id="listing-photo-preview" class="p-upload-preview" ${p?.photo?`src="${esc(productImage(p))}"`:'hidden'} alt="Preview photo of offer" /><label class="check-label"><input name="delivery" type="checkbox" ${p?.delivery?'checked':''} />Delivery available</label><p id="portal-form-error" class="form-error" hidden></p><div class="p-form-actions"><button type="submit" class="p-button primary">${icon('check')}${p?'Save changes':verified()?'Post an offer':'Save before review'}</button>${action('Cancel','nav','inventory')}</div></form>`);
  }
  const lotRemaining = lot => Math.max(0,lot.stock-db.claims.filter(c=>c.lotId===lot.id&&c.status!=='cancelled').reduce((s,c)=>s+c.qty,0));
  const validLot = l => { const owner=db.accounts.find(a=>a.id===l.ownerId); return l.expires>=dayKey()&&lotRemaining(l)>0&&(!owner||owner.role==='merchant'&&owner.verification==='verified'&&!owner.suspended); };
  function lotTable(lots) {return lots.length?table(['Products','City','Stock','Receipt','Best before'],lots.map(l=>`<tr><td><strong>${esc(l.name)}</strong><small>${number(l.weight)} kg / pcs.</small></td><td>${esc(l.city)}</td><td>${lotRemaining(l)} pcs.</td><td>${esc(l.pickup)}</td><td>${esc(l.expires)}</td></tr>`)):blank('No donations yet','Create a free donation from your inventory.');}
  function renderNGO() {
    const u=user(), claims=myClaims();
    if(tab==='verification') return `${stats([['Organization status',verified()?'Verified':'Under review','checkCircle','Status inside the demo'],['Reservations',claims.filter(c=>c.status==='reserved').length,'truck'],['Products received',`${number(claims.filter(c=>c.status==='received').reduce((s,c)=>s+c.qty*c.weight,0))} kg`,'handHeart']])}${card('Organization data',`<form id="ngo-verification-form" class="p-form"><div class="p-form-grid">${field('NPO name',`<input name="organization" value="${esc(u.organization||'')}" required maxlength="90" />`)}${field('City',`<select name="city">${options(Object.keys(cities).map(c=>[c,c]),u.city)}</select>`)}</div>${field('Organization documents (layout)','<input name="documents" type="file" accept=".pdf,image/jpeg,image/png" multiple /><small>Only the names of the selected files are saved. Demonstration verification by administrator.</small>')}<div class="p-document-list">${(u.documents||[]).map(n=>`<span>${icon('checkCircle')}${esc(n)}</span>`).join('')||'<span>No documents have been added yet.</span>'}</div><button type="submit" class="p-button primary">${icon('arrowRight')}Send for re-check</button></form>`)}${card('How to access',`<ol class="p-verification-steps"><li><b>01</b><span>Fill out the organization profile and add the names of the test documents.</span></li><li><b>02</b><span>In the demo panel, the administrator will approve the application.</span></li><li><b>03</b><span>Choose free products, reserve the quantity and time of receipt.</span></li></ol>`)}`;
    if(tab==='available') {
      const lots=db.lots.filter(validLot).filter(l=>(period==='all'||l.city===period)&&`${l.name} ${l.store}`.toLowerCase().includes(search.toLowerCase()));
      return `${card('Products ready to share',`<div class="p-toolbar"><label class="p-search">${icon('search')}<input id="donation-search" value="${esc(search)}" placeholder="Search for products or store" type="search" aria-label="Search for donations" /></label><select id="donation-city" aria-label="City of donation">${options([['all','All cities'],...Object.keys(cities).map(c=>[c,c])],period)}</select><div class="p-segment">${action('List','donation-mode','list',donationMode==='list'?'active':'')}${action('Map','donation-mode','map',donationMode==='map'?'active':'')}</div></div><div id="available-donations">${donationCards(lots)}</div>`)}`;
    }
    if(tab==='pickups') return card('Your bookings',claimTable(claims));
    if(tab==='receipts') return card('Acts of transfer of products',claims.some(c=>c.status==='received')?table(['Act','Products / store','Received','Date','Document'],claims.filter(c=>c.status==='received').map(c=>`<tr><td><strong>${esc(c.receipt||`ACT-${c.id.slice(-6)}`)}</strong>${badge('Demonstration')}</td><td>${esc(c.name)}<small>${esc(c.store)}</small></td><td>${c.qty} pcs. / ${number(c.qty*c.weight)} kg</td><td>${date(c.receivedAt)}</td><td>${action('Download the act','receipt',c.id)}</td></tr>`)):blank('Acts will appear after receipt','Book your products and mark your receipt in the “Reservations and Receipt“ tab.'));
    if(tab==='impact') {const received=claims.filter(c=>c.status==='received'&&(period==='all'||new Date(c.receivedAt)>=new Date(Date.now()-Number(period)*86400000))),kg=received.reduce((s,c)=>s+c.weight*c.qty,0);return `<div class="p-toolbar"><p class="p-description">Your contribution to helping the community</p><select id="impact-period" aria-label="Report period">${options([['all','All the time'],['7','Last 7 days'],['30','Last 30 days']],period)}</select></div>${stats([['Products received',`${number(kg)} kg`,'leaf'],['Completed transfers',received.length,'checkCircle'],['Stores helped',new Set(received.map(c=>c.store)).size,'store']])}${card('Every donation matters',`<div class="p-welcome"><span class="p-welcome-icon">${icon('handHeart')}</span><h2>Help starts with simple actions.</h2><p>Weight is calculated based on the products received. Number of servings and CO₂ are not assessed without a methodology.</p>${action('Download the report CSV','ngo-report','','primary')}</div>`)}`;}
    return '';
  }
  function donationCards(lots) {
    if(!lots.length)return blank('There are no suitable offers yet','Try another city or request. Stores can add products in the Donations tab.');
    const list=`<div class="p-donation-grid">${lots.map(l=>`<article class="p-donation-card"><div class="p-donation-image"><img src="./assets/images/${esc(l.image)}" alt="${esc(l.name)}" />${badge('Free','success')}</div><div><small>${esc(l.store)} · ${esc(l.city)}</small><h3>${esc(l.name)}</h3><p>${icon('bag')}Remaining ${lotRemaining(l)} pcs. · ${number(l.weight)} kg / pcs.</p><p>${icon('clock')}${esc(l.pickup)} · up to ${esc(l.expires)}</p>${action(`Book ${icon('arrowRight')}`,'claim',l.id,'primary',!verified()?'disabled':'')}</div></article>`).join('')}</div>`;
    return donationMode==='map'?`<div class="p-map-demo"><div class="p-map-roads"></div>${lots.map((l,i)=>`<button class="p-map-dot" style="left:${20+i*21}%;top:${25+(i%2)*30}%" data-portal="claim" data-id="${esc(l.id)}" ${!verified()?'disabled':''}>${icon('handHeart')}${esc(l.store)}</button>`).join('')}<span>Schematic map · markers do not reflect real locations</span></div>${list}`:list;
  }
  function claimTable(claims, merchant=false) {return claims.length?table(['Products / organization','Quantity','Receipt','Status','Actions'],claims.map(c=>`<tr><td><strong>${esc(c.name)}</strong><small>${esc(merchant?c.organization:c.store)}</small></td><td>${c.qty} pcs.<small>${number(c.qty*c.weight)} kg</small></td><td>${esc(c.pickupDate)}<small>${esc(c.pickup)}</small></td><td>${badge(c.status==='received'?'Received':c.status==='cancelled'?'Canceled':'Booked',c.status==='received'?'success':c.status==='cancelled'?'neutral':'warning')}</td><td><div class="p-row-actions">${c.status==='reserved'?(merchant?action('Confirm transfer','handover',c.id,'primary'):`${action('Mark receipt','receive-donation',c.id,'primary')}${action('Cancel','cancel-claim',c.id,'danger')}`):c.status==='received'?action('Donation receipt','receipt',c.id):'—'}</div></td></tr>`)):blank('No bookings yet','Select your free offer and pick up time.');}
  function showClaim(id) {
    if(!allowed('ngo')||!verified())return notify('Wait for the organization to be verified.');
    const lot=db.lots.find(l=>l.id===id);if(!lot||!validLot(lot))return notify('Offer no longer available.');
    showDialog('Book products',`<div class="p-claim-summary"><img src="./assets/images/${esc(lot.image)}" alt="${esc(lot.name)}" /><div><h3>${esc(lot.name)}</h3><p>${esc(lot.store)} · ${esc(lot.city)}</p>${badge('Free','success')}</div></div><div class="p-notice">${icon('info')}<span>${esc(lot.storage)}. Allergens: ${esc(lot.allergens)}. Best before ${esc(lot.expires)}.</span></div><form id="claim-form" class="form-stack" data-id="${esc(lot.id)}"><div class="form-row">${field(`Quantity · available ${lotRemaining(lot)}`,`<input name="qty" type="number" min="1" max="${lotRemaining(lot)}" step="1" value="1" required />`)}${field('Pickup date',`<input name="pickupDate" type="date" min="${dayKey()}" max="${lot.expires}" value="${dayKey()}" required />`)}</div>${field('Pickup time',`<select name="pickup"><option>${esc(lot.pickup)}</option></select>`)}<p class="p-description">${esc(lot.address)}. This is a demo address; notifications are not sent to the store.</p><p id="portal-form-error" class="form-error" hidden></p><button type="submit" class="button primary full-width">Confirm demo booking ${icon('check')}</button></form>`);
  }
  function renderAdmin() {
    const cases=[...db.cases,...state.reports], pending=cases.filter(c=>!c.status||c.status==='pending'), partners=db.accounts.filter(u=>['merchant','ngo'].includes(u.role));
    if(tab==='overview')return `${stats([['Platform orders',state.orders.length,'bag'],['Partner Vetting',partners.filter(u=>u.verification==='pending').length,'store'],['Cases in queue',pending.length,'info'],['Profiles in demo',db.accounts.length,'grid']])}<div class="p-two-columns">${card('Queues that need attention',`<div class="p-task-list"><a href="#portal/admin/moderation">${icon('info')}<span>Moderation of requests</span><b>${pending.length}</b></a><a href="#portal/admin/vetting">${icon('checkCircle')}<span>Checking stores and non-profit organizations</span><b>${partners.filter(u=>u.verification==='pending').length}</b></a><a href="#portal/admin/rules">${icon('sliders')}<span>Limited categories</span><b>${state.exclusions.length}</b></a></div>`)}${card('Prototype control',`<div class="p-welcome small"><span class="p-welcome-icon">${icon('sliders')}</span><h3>All actions are visible in the log</h3><p>Login, moderation and verification of partners form local records. The log is changeable and does not replace server auditing.</p>${action('Open security log →','nav','analytics')}</div>`)}</div>${card('Latest events',logsTable(db.logs.slice(0,5)))}`;
    if(tab==='moderation') return card('Customer requests',cases.length?table(['Appeal','Problem','Status','Solution'],cases.map(c=>`<tr><td><strong>${esc(c.orderId)}</strong><small>${date(c.createdAt)} ${c.example?'· example':''}</small></td><td><strong>${esc(c.reason)}</strong><small>${esc(c.description)}</small></td><td>${badge(!c.status||c.status==='pending'?'Waiting':c.status==='refunded'?'Return · demo':c.status==='blocked'?'Product blocked':'Reviewed',!c.status||c.status==='pending'?'warning':'success')}</td><td><div class="p-row-actions">${!c.status||c.status==='pending'?`${action('Return','moderate-refund',c.id||c.orderId)}${action('Block product','moderate-block',c.id||c.orderId,'danger')}${action('Close','moderate-resolve',c.id||c.orderId)}`:c.status==='blocked'?action('Unblock','unblock-case',c.id||c.orderId):'Solution saved'}</div></td></tr>`)):blank('The queue is empty','New requests will appear after reporting quality in the buyer’s history.'));
    if(tab==='vetting') return card('Checking stores and non-profit organizations',table(['Organization','Role / city','Documents','Status','Solution'],partners.map(u=>`<tr><td><strong>${esc(u.organization||u.name)}</strong><small>${esc(u.email)}</small></td><td>${roles[u.role].label}<small>${esc(u.city)}</small></td><td>${(u.documents||[]).map(esc).join('<br>')||'Document titles not added'}<small>Files are not uploaded to the server</small></td><td>${badge(u.verification==='verified'?'Approved':u.verification==='rejected'?'Rejected':'Under review',u.verification==='verified'?'success':u.verification==='rejected'?'danger':'warning')}</td><td><div class="p-row-actions">${u.verification!=='verified'?action('Approve','approve-partner',u.id,'primary'):''}${u.verification!=='rejected'?action('Reject','reject-partner',u.id,'danger'):''}</div></td></tr>`)));
    if(tab==='rules') return card('What categories can you post?',`<p class="p-description">A disabled category is hidden from the catalog and becomes unavailable for new offers. This is a local demonstration of moderation rules.</p><div class="p-rules">${categories.filter(c=>c.id!=='all').map(c=>`<label class="p-rule">${icon(c.icon)}<div><strong>${c.name}</strong><small>${state.exclusions.includes(c.id)?'Placement suspended':'Cleared for display'}</small></div><input type="checkbox" data-rule="${c.id}" ${!state.exclusions.includes(c.id)?'checked':''} role="switch" aria-label="Allow category ${c.name}" /></label>`).join('')}</div><div class="p-notice warning">${icon('info')}<span>Raw meat, raw fish and baby food are not included in the demo catalogue. The actual admission rules require separate verification.</span></div>`);
    if(tab==='users') return card('Users & Roles',`<div class="p-toolbar"><label class="p-search">${icon('search')}<input id="users-search" type="search" value="${esc(search)}" placeholder="Name, email or organization" aria-label="Search for users" /></label></div><div id="users-table">${usersTable(db.accounts.filter(u=>`${u.name} ${u.email} ${u.organization}`.toLowerCase().includes(search.toLowerCase())))}</div>`);
    if(tab==='analytics')return `${stats([['Amount of orders',money(state.orders.reduce((s,o)=>s+o.total,0)),'wallet'],['Products received',`${number(state.orders.filter(o=>o.status==='received').reduce((s,o)=>s+o.weight,0))} kg`,'leaf'],['Log Events',db.logs.length,'chart'],['Failed Entries',db.logs.filter(l=>l.outcome==='Denial').length,'info']])}${card('Log of actions and events',`${demoNotice('Entries are created only in this browser. This is an audit demonstration and not a protected security log.')}${logsTable(db.logs)}`,action('Export CSV','export-logs'))}`;
    return '';
  }
  function usersTable(users) {return table(['Profile','Role','Status','Management'],users.map(u=>`<tr><td><strong>${esc(u.name)} ${u.id===user()?.id?'(you)':''}</strong><small>${esc(u.email)}</small><small>${esc(u.organization||'')}</small></td><td><select class="p-role-select" data-user-role="${esc(u.id)}" aria-label="Role ${esc(u.name)}" ${u.id===user()?.id?'disabled':''}>${options(Object.entries(roles).map(([id,r])=>[id,r.label]),u.role)}</select></td><td>${badge(u.suspended?'Suspended':'Active',u.suspended?'danger':'success')}</td><td>${action(u.suspended?'Restore':'Suspend','suspend-user',u.id,u.suspended?'secondary':'danger',u.id===user()?.id?'disabled':'')}</td></tr>`));}
  function logsTable(logs) {return logs.length?table(['Date','Who','Action','Object','Result'],logs.map(l=>`<tr><td>${date(l.at)}</td><td>${esc(l.actor)}</td><td>${esc(l.action)}</td><td>${esc(l.subject)}</td><td>${badge(l.outcome,l.outcome==='Denial'?'danger':'success')}</td></tr>`)):blank('There are no events yet','Actions in your accounts will appear in the journal automatically.');}
  function download(filename, rows, text=false) {
    const content=text?rows:'\uFEFF'+rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:text?'text/plain;charset=utf-8':'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Demo document prepared');
  }
  function receipt(c) {
    if(!c||c.status!=='received')return;
    showDialog('Donation receipt · demonstration',`<div class="p-receipt"><div class="eyebrow">LOWS MARKET · DONATION RECEIPT</div><h3>Receipt no. ${esc(c.receipt)}</h3><dl><dt>Recipient organization</dt><dd>${esc(c.organization)}</dd><dt>Store</dt><dd>${esc(c.store)}</dd><dt>Products</dt><dd>${esc(c.name)} · ${c.qty} pcs. / ${number(c.qty*c.weight)} kg</dd><dt>Received</dt><dd>${date(c.receivedAt)}</dd></dl><p>Training document. Does not confirm actual transfer and is not intended for tax purposes.</p></div>${action('Download TXT','download-receipt',c.id,'primary')}`);
  }
  function markReceived(c) {c.status='received';c.receivedAt=new Date().toISOString();c.receipt=`ACT-${Date.now().toString(36).toUpperCase()}`;persist();log('Transfer of products to NPOs',c.name);renderPortal();notify('Receipt noted. The demo receipt has been created.');}
  function error(message,id='portal-form-error') {const el=$(`#${id}`);if(el){el.textContent=message;el.hidden=false;}else notify(message);}


  // Intercept legacy entry points so all business actions use the correct role.
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el)return;
    const name=el.dataset.action;
    if(['partner','listing','donation-form','checkout'].includes(name)) {
      event.preventDefault();event.stopImmediatePropagation();
      if(name==='checkout'){if(user()?.role==='buyer')openModal('checkout');else{afterAuth=()=>openModal('checkout');showAuth('login','buyer');}}
      if(name==='partner'||name==='listing'){if(dialog.open)closeModal();go('merchant',name==='listing'?'listing':'overview');}
      if(name==='donation-form'){if(dialog.open)closeModal();go(el.dataset.type==='ngo'?'ngo':'merchant',el.dataset.type==='ngo'?'available':'donations');}
    }
  },true);
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-portal]');if(!el||el.disabled)return;
    const name=el.dataset.portal,id=el.dataset.id;
    if(name==='account')showAccount();
    if(name==='auth')showAuth('login',id||'buyer');
    if(name==='signup')showAuth('signup',id||'buyer');
    if(name==='auth-tab')showAuth(id,authRole);
    if(name==='demo')demoLogin(id);
    if(name==='logout'){log('Logout');db.session=null;persist();closeModal();go('buyer');updateHeader();notify('You are logged out of your demo profile');}
    if(name==='my-portal'){closeModal();go(user()?.role||'buyer');}
    if(name==='nav'){editId=null;photoData=null;search='';go(view,id);}
    if(name==='edit-listing'&&allowed('merchant')){editId=id;photoData=null;go('merchant','listing');if(tab==='listing')renderPortal();}
    if(name==='pause-listing'&&allowed('merchant')){const p=myListings().find(p=>p.id===id);if(p&&!p.blocked){p.paused=!p.paused;save();log(p.paused?'Suspension of offer':'Renewal of offer',p.name);refresh({modal:false});renderPortal();}}
    if(name==='merchant-ready'&&allowed('merchant')){if(!merchantOrders().some(o=>o.id===id))return;db.orderStates[`${user().id}:${id}`]='ready';log('Store order confirmation',id);renderPortal();}
    if(name==='merchant-pickup'&&allowed('merchant')){if(!merchantOrders().some(o=>o.id===id))return;showDialog('Issue an order by code',`${demoNotice('Camera and Scan QR not connected. To demonstrate, enter the order code that the buyer sees in the story.')}<form id="merchant-pickup-form" class="form-stack" data-id="${esc(id)}">${field('Receipt code',`<input name="code" required placeholder="${esc(id)}" autocomplete="off" />`)}<p id="portal-form-error" class="form-error" hidden></p><button type="submit" class="button primary">Confirm issue</button></form>`);}
    if(name==='donation-mode'){donationMode=id;renderPortal();}
    if(name==='claim')showClaim(id);
    if(name==='cancel-claim'&&allowed('ngo')){const c=myClaims().find(c=>c.id===id);if(c?.status==='reserved'){c.status='cancelled';log('Cancellation of NPO booking',c.name);renderPortal();}}
    if(name==='receive-donation'&&allowed('ngo')){const c=myClaims().find(c=>c.id===id);if(c?.status==='reserved')markReceived(c);}
    if(name==='handover'&&allowed('merchant')){const c=db.claims.find(c=>c.id===id&&db.lots.find(l=>l.id===c.lotId)?.ownerId===user().id);if(c?.status==='reserved')markReceived(c);}
    if(name==='receipt'){const c=db.claims.find(c=>c.id===id&&(c.ngoId===user()?.id||db.lots.find(l=>l.id===c.lotId)?.ownerId===user()?.id||user()?.role==='admin'));receipt(c);}
    if(name==='download-receipt'){const c=db.claims.find(c=>c.id===id&&(c.ngoId===user()?.id||db.lots.find(l=>l.id===c.lotId)?.ownerId===user()?.id||user()?.role==='admin'));if(c)download(`${c.receipt}-DEMO.txt`,`LOWS MARKET — DEMONSTRATION ACT\n${c.receipt}\nRecipient: ${c.organization}\nStore: ${c.store}\n${c.name}: ${c.qty} pcs., ${number(c.qty*c.weight)} kg\nDate: ${date(c.receivedAt)}\nTraining document. Does not confirm the actual transmission.`,true);}
    if(name==='merchant-report'&&allowed('merchant'))download('LowS-merchant-DEMO.csv',[['Merchant report (demo)',user().organization],['Product','Regular price','Discount price','Stock','Use-by date','Status'],...myListings().map(p=>[p.name,p.original,p.price,available(p),p.expiration,p.paused?'Pause':'Active'])]);
    if(name==='ngo-report'&&allowed('ngo'))download('LowS-NPO-DEMO.csv',[['NPO Demonstration Report',user().organization],['Products','Store','Quantity','Weight, kg','Date'],...myClaims().filter(c=>c.status==='received'&&(period==='all'||new Date(c.receivedAt)>=new Date(Date.now()-Number(period)*86400000))).map(c=>[c.name,c.store,c.qty,c.qty*c.weight,c.receivedAt])]);
    if(['approve-partner','reject-partner'].includes(name)&&allowed('admin')){const u=db.accounts.find(a=>a.id===id&&['merchant','ngo'].includes(a.role));if(!u)return;u.verification=name==='approve-partner'?'verified':'rejected';state.listings.filter(p=>p.ownerId===u.id).forEach(p=>p.pending=u.verification!=='verified');save();log(u.verification==='verified'?'Partner approval':'Partner’s rejection',u.organization);refresh({modal:false});renderPortal();}
    if(name.startsWith('moderate-')&&allowed('admin')){const c=[...db.cases,...state.reports].find(c=>(c.id||c.orderId)===id);if(!c||c.status&&c.status!=='pending')return;c.status=name==='moderate-refund'?'refunded':name==='moderate-block'?'blocked':'resolved';c.resolvedAt=new Date().toISOString();if(c.status==='refunded'){const o=state.orders.find(o=>o.id===c.orderId);if(o)o.refunded=true;}if(c.status==='blocked'){const o=state.orders.find(o=>o.id===c.orderId);if(c.productId){const p=product(c.productId);if(p){if(state.listings.includes(p))p.blocked=true;else {db.blockedSeed=[...new Set([...(db.blockedSeed||[]),p.id])];p.blocked=true;}}}else o?.items.forEach(i=>{const p=product(i.id);if(p){p.blocked=true;if(!state.listings.includes(p))db.blockedSeed=[...new Set([...(db.blockedSeed||[]),p.id])];}});}save();log('Decision on appeal',`${c.orderId}: ${c.status}`);refresh({modal:false});renderPortal();}
    if(name==='unblock-case'&&allowed('admin')){const c=[...db.cases,...state.reports].find(c=>(c.id||c.orderId)===id);if(!c||c.status!=='blocked')return;const ids=c.productId?[c.productId]:(state.orders.find(o=>o.id===c.orderId)?.items.map(i=>i.id)||[]);for(const pid of ids){const p=product(pid);if(p)p.blocked=false;}db.blockedSeed=(db.blockedSeed||[]).filter(pid=>!ids.includes(pid));c.status='resolved';save();log('Unlock offer',c.orderId);refresh({modal:false});renderPortal();}
    if(name==='suspend-user'&&allowed('admin')){const u=db.accounts.find(a=>a.id===id);if(!u||u.id===user().id)return;u.suspended=!u.suspended;state.listings.filter(p=>p.ownerId===u.id).forEach(p=>p.ownerSuspended=u.suspended);save();log(u.suspended?'Account suspension':'Account recovery',u.email);refresh({modal:false});renderPortal();}
    if(name==='export-logs'&&allowed('admin'))download('LowS-audit-DEMO.csv',[['Date','Member','Action','Object','Result'],...db.logs.map(l=>[l.at,l.actor,l.action,l.subject,l.outcome])]);
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='inventory-search'){search=event.target.value;$('#inventory-table').innerHTML=inventoryTable(myListings().filter(p=>p.name.toLowerCase().includes(search.toLowerCase())));}
    if(event.target.id==='users-search'){search=event.target.value;$('#users-table').innerHTML=usersTable(db.accounts.filter(u=>`${u.name} ${u.email} ${u.organization}`.toLowerCase().includes(search.toLowerCase())));}
    if(event.target.id==='donation-search'){search=event.target.value;$('#available-donations').innerHTML=donationCards(db.lots.filter(validLot).filter(l=>(period==='all'||l.city===period)&&`${l.name} ${l.store}`.toLowerCase().includes(search.toLowerCase())));}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='auth-role')syncAuthFields();
    if(el.id==='donation-city'||el.id==='impact-period'){period=el.value;renderPortal();}
    if(el.dataset.rule&&allowed('admin')){const id=el.dataset.rule;if(!categories.some(c=>c.id===id))return;state.exclusions=el.checked?state.exclusions.filter(c=>c!==id):[...new Set([...state.exclusions,id])];save();log('Category Rule',`${id}: ${el.checked?'allowed':'disabled'}`);refresh({modal:false});renderPortal();}
    if(el.dataset.userRole&&allowed('admin')){const u=db.accounts.find(u=>u.id===el.dataset.userRole);if(!u||u.id===user().id||!roles[el.value])return;u.role=el.value;u.verification=['merchant','ngo'].includes(u.role)?'pending':'verified';state.listings.filter(p=>p.ownerId===u.id).forEach(p=>{p.ownerRoleInvalid=u.role!=='merchant';p.pending=u.verification!=='verified';});save();refresh({modal:false});log('Role change',`${u.email}: ${roles[u.role].label}`);renderPortal();}
    if(el.id==='listing-photo'){
      const file=el.files[0];if(!file){photoData=null;return;}
      if(file.size>400*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){el.value='';return notify('Select JPG, PNG or WebP up to 400 KB.');}
      const reader=new FileReader();reader.onload=()=>{photoData=reader.result;const image=$('#listing-photo-preview');if(image){image.src=photoData;image.hidden=false;}};reader.readAsDataURL(file);
    }
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!['role-auth-form','admin-code-form','profile-form','portal-listing-form','merchant-donation-form','claim-form','ngo-verification-form','merchant-pickup-form'].includes(form.id))return;
    event.preventDefault();if(!form.reportValidity())return;
    const d=new FormData(form);
    if(form.id==='role-auth-form'){
      if(authBusy)return;
      const mode=form.dataset.mode,role=d.get('role'),email=d.get('email').trim().toLowerCase(),pw=d.get('password');
      if(!roles[role])return error('Select a role.','auth-error');
      const exists=db.accounts.find(a=>a.email===email);
      if(mode==='signup'){
        if(exists)return error('This one email already registered. Go to the login tab.','auth-error');
        if(pw!==d.get('confirmPassword'))return error('The passwords do not match.','auth-error');
        if(!d.get('displayName').trim())return error('Please provide a name.','auth-error');
        if(['merchant','ngo'].includes(role)&&!d.get('organization')?.trim())return error('Enter the name of the organization.','auth-error');
      }else if(!exists||exists.role!==role||exists.suspended||exists.reviewOnly){log('Failed login',roles[role].label,'Denial');return error('Check email, role and profile availability.','auth-error');}
      authBusy=true;const submit=$('button[type="submit"]',form);submit.disabled=true;submit.textContent='Let’s check...';
      try{
        let account=exists;
        if(mode==='signup'){
          const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
          const hash=await passwordHash(pw,salt);
          const documents=[...form.elements.documents?.files||[]];
          if(documents.some(f=>f.size>5*1024*1024))throw new Error('The document layout must be less than 5 MB.');
          account={id:uid('user'),name:d.get('displayName').trim(),organization:d.get('organization')?.trim()||'',email,role,city:state.city,verification:['merchant','ngo'].includes(role)?'pending':'verified',documents:documents.map(f=>f.name),salt,hash,createdAt:new Date().toISOString()};
          db.accounts.push(account);persist();log('Profile registration',roles[role].label);
        }else {
          const match=account.demo?pw==='Demo1234':await passwordHash(pw,account.salt)===account.hash;
          if(!match){log('Failed login',roles[role].label,'Denial');throw new Error('Invalid test password.');}
        }
        if(role==='admin')challengeAdmin(account);else finishLogin(account);
      }catch(e){error(e.message||'Failed to save profile.','auth-error');}finally{authBusy=false;if(submit.isConnected){submit.disabled=false;submit.textContent=mode==='signup'?'Create a demo profile':'Login';}}
    }
    if(form.id==='admin-code-form'){
      if(d.get('code')!=='123456'){log('Second step error','Administrator','Denial');return error('Test code: 123456.','auth-error');}
      const account=db.accounts.find(a=>a.id===pendingAdmin&&a.role==='admin'&&!a.suspended);if(account){pendingAdmin=null;finishLogin(account);}
    }
    if(form.id==='profile-form'){
      const u=user();if(!u)return;const name=d.get('displayName').trim();if(!name)return notify('Please provide a name.');u.name=name;u.city=d.get('city');if(d.has('organization'))u.organization=d.get('organization').trim();persist();log('Profile update');updateHeader();if(view!=='buyer')renderPortal();closeModal();notify('Profile updated');
    }
    if(form.id==='portal-listing-form'){
      if(!allowed('merchant'))return;
      const price=Number(d.get('price')),original=Number(d.get('original')),qty=Number(d.get('stock')),weight=Number(d.get('weight')),category=d.get('category'),expiry=d.get('expiration');
      if(price/original<.3-1e-8||price/original>.6+1e-8)return error('The discount should be from 40 to 70%. For example, 500 ₸ instead of 1,000 ₸.');
      if(state.exclusions.includes(category))return error('The administrator has temporarily restricted this category. Choose another one.');
      if(expiry<dayKey())return error('Expired products cannot be posted.');
      if(!Number.isInteger(qty)||qty<0||weight<=0)return error('Check quantity and weight.');
      for(const k of ['name','description','allergens','storage'])if(!d.get(k).trim())return error('Fill out all text fields.');
      const existing=myListings().find(p=>p.id===form.dataset.edit), image={bakery:'bakery.jpg',vegetables:'vegetables.jpg',fruit:'fruit.jpg',dairy:'dairy.jpg',meals:'lunch.jpg',surprise:'bread.jpg'}[category];
      if(!image)return error('Select an acceptable category.');
      // The form edits the available quantity; preserve already reserved units in the lot total.
      const sold=existing?existing.stock-available(existing):0;
      const p={...(existing||{}),id:existing?.id||`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,ownerId:user().id,store:user().organization||user().name,city:user().city||state.city,name:d.get('name').trim(),category,image,photo:photoData||existing?.photo||null,price,original,stock:qty+sold,weight,expiration:expiry,subtitle:`${category==='surprise'?'Mystery Bundle':'Store offer'} · ${number(weight)} kg`,description:d.get('description').trim(),ingredients:d.get('description').trim(),allergens:d.get('allergens').trim(),storage:d.get('storage').trim(),pickup:d.get('pickup'),delivery:d.get('delivery')==='on',diet:'all',color:'#e7dfca',tag:category==='surprise'?'Mystery Bundle':'From the store',pending:!verified(),createdAt:existing?.createdAt||new Date().toISOString()};
      if(existing)Object.assign(existing,p);else state.listings.unshift(p);
      save();log(existing?'Change of offer':'Publication of an offer',p.name);editId=null;photoData=null;refresh({modal:false});go('merchant','inventory');notify(p.pending?'Draft saved until store review':'The offer has been saved in the catalog');
    }
    if(form.id==='merchant-donation-form'){
      if(!allowed('merchant'))return;if(!verified())return notify('Transfer is available after checking the store.');
      const p=myListings().find(p=>p.id===d.get('listing')),qty=Number(d.get('qty'));if(!p||!Number.isInteger(qty)||qty<1||qty>available(p)||daysLeft(p)<0)return notify('Check expiration date and quantity available.');
      p.stock-=qty;db.lots.unshift({id:uid('lot'),listingId:p.id,ownerId:user().id,name:p.name,store:p.store,city:p.city,stock:qty,weight:p.weight,image:p.image,expires:p.expiration,pickup:p.pickup,allergens:p.allergens,storage:p.storage,address:`Demo: ${cities[p.city]?.street||''}`});save();persist();log('Products transferred to the help center',p.name);refresh({modal:false});renderPortal();notify('Free offer available for NPOs');
    }
    if(form.id==='claim-form'){
      if(!allowed('ngo')||!verified())return;
      const lot=db.lots.find(l=>l.id===form.dataset.id),qty=Number(d.get('qty')),pickupDate=d.get('pickupDate');
      if(!lot||!Number.isInteger(qty)||qty<1||qty>lotRemaining(lot)||pickupDate<dayKey()||pickupDate>lot.expires)return error('Check quantity and date: offer may have changed.');
      db.claims.unshift({id:uid('claim'),lotId:lot.id,ngoId:user().id,organization:user().organization,name:lot.name,store:lot.store,qty,weight:lot.weight,pickupDate,pickup:lot.pickup,createdAt:new Date().toISOString(),status:'reserved'});persist();log('Reservation of NPO products',lot.name);closeModal();go('ngo','pickups');notify('Booking saved in demo');
    }
    if(form.id==='ngo-verification-form'){
      if(!allowed('ngo'))return;const files=[...form.elements.documents.files];if(files.some(f=>f.size>5*1024*1024))return notify('Use test files up to 5 MB.');user().organization=d.get('organization').trim();user().city=d.get('city');if(files.length)user().documents=files.map(f=>f.name);user().verification='pending';log('Application for verification of an NPO',user().organization);renderPortal();notify('The request has appeared in the administrator’s queue');
    }
    if(form.id==='merchant-pickup-form'){
      if(!allowed('merchant'))return;const o=merchantOrders().find(o=>o.id===form.dataset.id);if(!o||d.get('code').trim().toUpperCase()!==o.id.toUpperCase())return error('The code does not match this order.');db.orderStates[`${user().id}:${o.id}`]='handed';if(o.items.every(i=>{const p=state.listings.find(p=>p.id===i.id);return p&&db.orderStates[`${p.ownerId}:${o.id}`]==='handed';}))o.status='received';save();log('Issuing an order by code',o.id);closeModal();renderPortal();notify('Issue confirmed in demo');
    }
  });
  for(const id of db.blockedSeed||[]){const p=product(id);if(p)p.blocked=true;}
  window.addEventListener('hashchange',()=>{search='';period='all';editId=location.hash.endsWith('/listing')?editId:null;route();});
  window.addEventListener('lows:changed',()=>{updateHeader();if(view!=='buyer')renderPortal();});
  route();refresh({modal:false});
  return {user,go,render:renderPortal,
    aiContext:()=>({role:view,userId:user()?.id||'guest',access:view==='buyer'||user()?.role===view,verified:verified(),city:user()?.city||state.city,
      inventory:view==='merchant'&&user()?.role==='merchant'?myListings().map(p=>({...p,remaining:available(p),days:daysLeft(p)})):[],
      lots:view==='ngo'&&user()?.role==='ngo'?db.lots.filter(validLot).map(l=>({...l,remaining:lotRemaining(l)})):[],
      claims:view==='ngo'&&user()?.role==='ngo'?myClaims().map(c=>({...c})):[],
      moderation:view==='admin'&&user()?.role==='admin'?{pending:[...db.cases,...state.reports].filter(c=>!c.status||c.status==='pending').map(c=>({reason:c.reason,createdAt:c.createdAt})),partners:db.accounts.filter(a=>['merchant','ngo'].includes(a.role)&&a.verification==='pending').length,exclusions:state.exclusions.length}:null}),
    editListing:id=>{if(!allowed('merchant')||!myListings().some(p=>p.id===id))return;editId=id;photoData=null;go('merchant','listing');if(tab==='listing')renderPortal();},
    applyPrice:(id,value)=>{if(!allowed('merchant'))return false;const p=myListings().find(p=>p.id===id),price=Number(value);if(!p||!Number.isInteger(price)||price<p.original*.3-1e-8||price>p.original*.6+1e-8||daysLeft(p)<0||p.blocked||available(p)<1)return false;p.price=price;save();log('Using price hint (demo)',p.name);refresh({modal:false});if(view==='merchant')renderPortal();return true;},
    openClaim:showClaim
  };
}
