// A deterministic, local prototype of AI-assisted workflows. No model/API call.
// Keep this pure response contract when connecting a real model behind a server.
export function createDemoReply(input, context) {
  const query=String(input||'').trim().slice(0,300).toLocaleLowerCase('en');
  const role=context.role||'buyer';
  if(!context.access)return {type:'info',title:'The assistant takes into account your role',text:'To work with the data of this account, log in to a suitable demo profile. Data for other roles is not shown here.',destination:{role,tab:role==='ngo'?'verification':'overview'},destinationLabel:'Open account'};
  if(role==='merchant') {
    const inventory=(context.inventory||[]).filter(p=>p.remaining>0&&p.days>=0&&!p.blocked&&!p.ownerSuspended&&!p.paused).sort((a,b)=>a.days-b.days||b.remaining-a.remaining);
    const countToday=inventory.filter(p=>p.days===0).length;
    if(!inventory.length)return {type:'info',title:'Start with your inventory',text:'No active listings have stock available. Add a product or resume a listing in Inventory.',destination:{role:'merchant',tab:'listing'},destinationLabel:'Add product'};
    if(/bundle|surprise|combine|set/.test(query)) {
      const selected=inventory.slice(0,3),original=selected.reduce((s,p)=>s+p.original,0), price=Math.max(Math.ceil(original*.3),Math.floor(original*.4/10)*10);
      return {type:'bundle',title:'A mystery bundle from your surplus',text:'Draft: one unit of each item below. Check ingredients and compatible storage conditions before publishing.',items:selected.map(p=>({id:p.id,name:p.name,quantity:1})),original,price,destination:{role:'merchant',tab:'bundles'},destinationLabel:'Create a mystery bundle',note:'Stock has not changed. Confirm the weight, ingredients, allergens and use-by date in the form.'};
    }
    return {type:'merchant',title:countToday?'These products need a chance today':'Your surplus action plan',text:countToday?`${countToday} listings expire today. Start with these, then review items expiring tomorrow.`:'No current listings expire today. Here are the next items to review, ordered by use-by date.',items:inventory.slice(0,4).map(p=>{
      const target=p.days===0?.3:p.days===1?.4:.5;
      const price=Math.min(p.price,Math.max(Math.ceil(p.original*.3),Math.min(Math.floor(p.original*.6),Math.round(p.original*target/10)*10)));
      return {id:p.id,name:p.name,remaining:p.remaining,days:p.days,currentPrice:p.price,price,original:p.original,reason:p.days===0?'Expires today: suggested discount 70%.':p.days===1?'Expires tomorrow: suggested discount 60%.':'More time remaining: suggested discount 50%.'};
    }),note:'Demo pricing rule based on use-by dates, without a demand forecast. Prices change only after you confirm, in this browser.',destination:{role:'merchant',tab:'donations'},destinationLabel:'Consider donating to help'};
  }
  if(role==='ngo') {
    if(!context.verified)return {type:'info',title:'First you need to check the organization',text:'After approval by the administrator, you can book products. For now, check the profile and test documents of the NPO.',destination:{role:'ngo',tab:'verification'},destinationLabel:'Check NPO profile'};
    if(/impact|contribution|report|received|result|stats/.test(query)) {
      const received=(context.claims||[]).filter(c=>c.status==='received');
      return {type:'summary',title:'Your donation impact',text:'Based on confirmed donations received by this demo profile.',stats:[{label:'Products received',value:received.reduce((s,c)=>s+c.qty*c.weight,0),unit:'kg'},{label:'Transfers completed',value:received.length,unit:''},{label:'Stores helped',value:new Set(received.map(c=>c.store)).size,unit:''}],note:'Portions, number of recipients and CO₂ are not assessed: they require additional data.',destination:{role:'ngo',tab:'impact'},destinationLabel:'Open help report'};
    }
    const requestedCity=[['Almaty',/Almaty|almaty/],['Astana',/Astana|astana/],['Shymkent',/Shymkent|shymkent/]].find(([,pattern])=>pattern.test(query))?.[0];
    const city=requestedCity||context.city;
    const lots=(context.lots||[]).filter(l=>l.city===city&&l.remaining>0&&l.expires>=context.today).sort((a,b)=>a.expires.localeCompare(b.expires)||a.pickup.localeCompare(b.pickup)).slice(0,3);
    return {type:'ngo',title:lots.length?'What can you pick up first?':'There are no offers in this city yet',text:lots.length?`City — ${city}. Products with the closest expiration date come first. Please select the exact quantity and date when booking.`:`Around the city «${city}» There are currently no suitable free offers. You can select another city from the general list.`,lots:lots.map(l=>({id:l.id,name:l.name,store:l.store,remaining:l.remaining,weight:l.weight,pickup:l.pickup,expires:l.expires,image:l.image})),note:'This is a priority based on the timing and intervals of receipt, and not a geographical route. The map and addresses in the project are for demonstration purposes.',destination:{role:'ngo',tab:'available'},destinationLabel:'All free offers'};
  }
  if(role==='admin') {
    const m=context.moderation||{pending:[],partners:0,exclusions:0};
    const reasons=[...new Set(m.pending.map(c=>c.reason))].filter(Boolean);
    return {type:'summary',title:'What should an administrator pay attention to?',text:'Summary of current queues. The Assistant does not make decisions about blocking, returning or admitting organizations.',stats:[{label:'Open requests',value:m.pending.length,unit:''},{label:'Partners under review',value:m.partners,unit:''},{label:'Limited categories',value:m.exclusions,unit:''}],steps:[m.pending.length?`Sort out requests: ${reasons.join(', ')||'reason not specified'}. Check the description with your order.`:'The request queue is currently empty.',m.partners?'Check organizations’ applications and test documents. The status is confirmed by the administrator.':'There are no new partner applications for verification.','Record your decision in the appropriate tab. The action will appear in the local log.'],destination:{role:'admin',tab:/partner|organization|vetting|verif/.test(query)&&!/complaint|issue|request/.test(query)?'vetting':'moderation'},destinationLabel:/partner|organization|vetting|verif/.test(query)&&!/complaint|issue|request/.test(query)?'Partner Vetting':'Open moderation',note:'The summary is built by status and quantity. The reliability of organizations and the validity of complaints are not automatically assessed.'};
  }
  const supported=/find|select|choose|buy|product|food|dinner|lunch|breakfast|snack|cook|recipe|cheap|save|saving|budget|discount|surprise|bread|pastr|bakery|croissant|vegetable|fruit|milk|dairy|yogurt|vegan|plant.based|vegetarian|without|free|delivery|under|up to|tenge|kzt|₸/.test(query);
  if(!supported)return {type:'info',title:'Let’s find something tasty',text:'In this demo I understand queries about products, budget, delivery and dietary preferences. For example: “Dinner up to 3000 ₸ without milk.“ Questions outside the catalog are not supported in this demo.'};
  const budgetMatch=query.match(/(?:up to|under|below|budget|maximum|max|no more than|limit|until)\s*[:—-]?\s*(\d+(?:[ ,]\d{3})*(?:\.\d+)?)\s*(thousand|k)?/)||query.match(/(\d+(?:[ ,]\d{3})*(?:\.\d+)?)\s*(thousand|k)?\s*(?:₸|tenge|kzt)/);
  const budget=budgetMatch?Math.round(Number(budgetMatch[1].replace(/[ ,]/g,''))*(budgetMatch[2]?1000:1)):null;
  const vegan=/vegan|plant[ -]based/.test(query),vegetarian=/vegetarian|(?:without|no)\s+meat|meat[ -]free/.test(query);
  const noMilk=/(?:without|no)\s+(?:milk|dairy|lactose)|(?:milk|dairy|lactose)[ -]free/.test(query);
  const noGluten=/(?:without|no)\s+gluten|gluten[ -]free/.test(query),noNuts=/(?:without|no)\s+nuts?|nut[ -]free/.test(query);
  const delivery=/delivery|deliver/.test(query)&&!/(?:without|no)\s+delivery|pickup|pick.up/.test(query),fee=delivery?700:0;
  const dietary=vegan||vegetarian||noMilk||noGluten||noNuts;
  const cooking=/cook|recipe|prepare/.test(query),dinner=/dinner|lunch|cook|recipe|prepare/.test(query),breakfast=/breakfast/.test(query);
  let category=null;
  if(/surprise/.test(query))category='surprise';
  else if(!dinner&&!breakfast&&/bread|bake|croissant/.test(query))category='bakery';
  else if(!dinner&&!breakfast&&/vegetable/.test(query))category='vegetables';
  else if(!dinner&&!breakfast&&/fruit/.test(query))category='fruit';
  else if(!dinner&&!breakfast&&!noMilk&&/milk|milk|yogurt/.test(query))category='dairy';
  const filters=[budget!==null?`Up to ${budget} ₸`:null,vegan?'Plant-based':vegetarian?'Vegetarian':null,noMilk?'No dairy ingredients':null,noGluten?'Gluten free as described':null,noNuts?'No nuts as described':null,delivery?'With delivery':'Pickup'].filter(Boolean);
  let candidates=(context.products||[]).filter(p=>p.remaining>0&&p.days>=0&&!p.paused&&!p.blocked&&!p.pending&&!p.ownerSuspended&&!p.ownerRoleInvalid);
  candidates=candidates.filter(p=>{
    if(delivery&&!p.delivery)return false;
    if(category&&p.category!==category)return false;
    if(dietary&&p.category==='surprise')return false;
    if(vegan&&p.diet!=='vegan')return false;
    if(vegetarian&&!['vegan','vegetarian'].includes(p.diet))return false;
    const composition=`${p.ingredients||''} ${p.allergens||''}`.toLowerCase();
    if(noMilk&&/milk|dairy|butter|cream|yogurt|yoghurt|lactose/.test(composition))return false;
    if(noGluten&&/gluten|wheat|rye|barley/.test(composition))return false;
    if(noNuts&&/nut|peanut|almond|hazelnut|pistachio/.test(composition))return false;
    return true;
  });
  function score(p) {
    let value=(1-p.price/p.original)*10+(p.days===0?1:0);
    if(dinner)value+=({meals:cooking?4:20,vegetables:cooking?25:15,bakery:10,fruit:-6,dairy:-5,surprise:-6}[p.category]||0);
    if(cooking&&p.id==='sourdough')value+=15;
    if(breakfast)value+=({bakery:15,dairy:12,fruit:8,meals:-4,vegetables:-4}[p.category]||0);
    if(/cheap|save|saving|econom/.test(query))value-=p.price/300;
    if(/today|expir/.test(query))value+=p.days===0?12:0;
    return value;
  }
  candidates.sort((a,b)=>score(b)-score(a)||a.price-b.price||a.id.localeCompare(b.id));
  const maxCount=/(?:one|1)\s+(?:product|item)/.test(query)?1:dinner||breakfast?2:3;
  let remainingBudget=budget===null?Infinity:Math.max(0,budget-fee);
  const selected=[];
  for(const p of candidates){if(selected.length>=maxCount)break;if(p.price>remainingBudget)continue;selected.push(p);remainingBudget-=p.price;}
  const subtotal=selected.reduce((s,p)=>s+p.price,0),original=selected.reduce((s,p)=>s+p.original,0),weight=selected.reduce((s,p)=>s+p.weight,0);
  let recipe=null;
  if(cooking&&selected.some(p=>p.id==='veggie-box')&&selected.some(p=>p.id==='sourdough'))recipe={title:'Vegetable Salad with Toast',steps:['Wash and cut the vegetables from the kit.','Slice the bread and brown in a dry frying pan.','Serve toast with vegetables. Use dressing from your pantry if you like.'],note:'Extra dressing is not included in the price. This is a meal idea, not a serving calculation.'};
  return {type:'shopping',title:selected.length?'Here’s what suits your request':'Nothing matched these conditions.',text:selected.length?`${selected.length} items in ${context.city}, one unit of each.`:'I won’t change your restrictions: try increasing your budget, choosing pickup, or clarifying your request.',filters,budget,fee,subtotal,total:subtotal+(selected.length?fee:0),savings:original-subtotal,weight,recipe,products:selected.map(p=>({id:p.id,name:p.name,quantity:1,price:p.price,original:p.original,reason:p.days===0?'Use by the end of today':p.diet==='vegan'?'Plant-based ingredients listed':'Suitable for request'})),note:`${dietary?'Selection according to descriptions: check the exact composition and allergens in the card. ':''}${delivery?'700 ₸ will be added when selecting delivery at checkout. ':''}${context.cartTotal?'The cost of the new selection is indicated. Items already in the cart are counted separately. ':''}Availability is checked again before adding.`};
}

export function initAssistant(ctx) {
  const {state,icon,escape:esc,money,number,productImage,product,available,daysLeft,listed,inCity,catalogProducts,save,refresh,notify,openModal,portals}=ctx;
  const $=s=>document.querySelector(s);
  const roleInfo={
    buyer:{name:'Find your next good meal',subtitle:'Suggestions for your budget and preferences',prompts:['Dinner under 3000 ₸ without milk','What can I cook under 2500 ₸?','Find the best discounts'],placeholder:'Try: breakfast under 2000 ₸'},
    merchant:{name:'Give surplus another chance',subtitle:'Use-by dates, prices and mystery bundles',prompts:['What should I save first?','Suggest prices for my surplus','Help me create a mystery bundle'],placeholder:'Try: what should I sell today?'},
    ngo:{name:'Plan your next donation pickup',subtitle:'Available food, pickups and your impact',prompts:['What should I pick up first?','Find free food in Almaty','Show my impact'],placeholder:'Try: what is available in Astana?'},
    admin:{name:'A clearer view for the LowS team',subtitle:'Issues, partners and the review queue',prompts:['What needs attention now?','Summarize customer issues','Which partners need verification?'],placeholder:'Try: where should moderation start?'},
  };
  const spark='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7L20 2Z"/></svg>';
  const button=(text,action,extra='',cls='')=>`<button class="ai-button ${cls}" data-ai="${action}" ${extra}>${text}</button>`;
  const dataAttr=(key,value)=>`data-${key}="${esc(value)}"`;
  const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  let history=[],lastFocus=null,contextKey='',serial=0;
  function context() {
    const portal=portals?.aiContext?.()||{role:'buyer',access:true,userId:'guest',city:state.city};
    if(portal.role==='buyer')return {...portal,city:state.city,today:day(),cartTotal:Object.entries(state.cart).reduce((s,[id,q])=>s+(product(id)?.price||0)*q,0),products:catalogProducts().filter(p=>inCity(p)&&listed(p)&&daysLeft(p)>=0).map(p=>({...p,days:daysLeft(p),remaining:Math.max(0,available(p)-(state.cart[p.id]||0))}))};
    return {...portal,today:day()};
  }
  document.body.insertAdjacentHTML('beforeend',`<button id="ai-launcher" class="ai-launcher" data-ai="open" aria-label="Open LowS AI — demo assistant">${spark}<span>LowS <b>AI</b><small>Help me choose</small></span><span class="ai-launcher-dot"></span></button><dialog id="ai-dialog" class="ai-dialog" aria-labelledby="ai-dialog-title"><div class="ai-panel-head"><span class="ai-brand-icon">${spark}</span><div><h2 id="ai-dialog-title">LowS <span>AI</span></h2><p id="ai-role-label"></p></div><span class="ai-local-badge">DEMO</span><button class="ai-close" data-ai="close" aria-label="Close assistant">${icon('close')}</button></div><div class="ai-transparency">${icon('info')}<span>Local demo. No language model is connected; your requests stay in this browser.</span></div><div id="ai-conversation" class="ai-conversation" role="log" aria-label="Dialogue with the assistant" aria-live="polite" aria-relevant="additions text"></div><div class="ai-panel-bottom"><div id="ai-suggestions" class="ai-suggestions"></div><form id="ai-query-form" class="ai-query-form"><label class="sr-only" for="ai-query">Request to assistant</label><input id="ai-query" name="query" maxlength="300" autocomplete="off" required /><button type="submit" aria-label="Select options">${icon('arrowRight')}</button></form><div class="ai-footer-meta"><span>${icon('leaf')}Recommendations based on prototype data</span><button data-ai="reset">Clear dialog</button></div></div></dialog>`);
  const dialog=$('#ai-dialog');
  function sync() {
    const c=context(),key=`${c.role}:${c.userId}:${c.city}`;
    if(key!==contextKey){history=[];contextKey=key;}
    const info=roleInfo[c.role]||roleInfo.buyer;
    $('#ai-launcher small').textContent=c.role==='buyer'?'Help me choose':c.role==='merchant'?'Help the store':c.role==='ngo'?'Help for NGOs':'Team Summary';
    $('#ai-role-label').textContent=info.subtitle;
    $('#ai-query').placeholder=info.placeholder;
    $('#ai-suggestions').innerHTML=info.prompts.map(q=>button(esc(q),'prompt',dataAttr('query',q),'suggestion')).join('');
    const header=$('.p-page-header');
    if(header&&!$('#ai-portal-banner'))header.insertAdjacentHTML('afterend',`<div id="ai-portal-banner" class="ai-portal-banner"><span class="ai-banner-icon">${spark}</span><div><strong>${info.name}</strong><p>${info.subtitle}. Demo assistant LowS AI.</p></div>${button(`Ask LowS AI ${icon('arrowUpRight')}`,'open','','banner-action')}</div>`);
    if(dialog.open)renderConversation();
  }
  function intro() {
    const c=context(),info=roleInfo[c.role]||roleInfo.buyer;
    return `<div class="ai-welcome"><span class="ai-welcome-mark">${spark}</span><span class="eyebrow">TASTY SOLUTIONS START WITH A QUESTION</span><h3>${info.name}</h3><p>${c.role==='buyer'?'Tell us what you want to buy, how much you are willing to spend and what products you prefer. I’ll collect options from the current catalog.':c.role==='merchant'?'Review your store’s use-by dates and stock. I’ll suggest what to prioritize and prices to consider.':c.role==='ngo'?'I will help you choose products by city and date, and then proceed to booking.': 'I’ll show you a summary of the queues to make it easier for the team to get started.'}</p><div class="ai-welcome-chips"><span>${icon('tag')}Catalog data</span><span>${icon('checkCircle')}Your confirmation</span></div></div>`;
  }
  function renderResponse(reply,index) {
    let html=`<h3>${esc(reply.title)}</h3><p>${esc(reply.text)}</p>`;
    if(reply.filters)html+=`<div class="ai-filter-tags">${reply.filters.map(f=>`<span>${esc(f)}</span>`).join('')}</div>`;
    if(reply.type==='shopping'&&reply.products.length) {
      html+=`<div class="ai-products">${reply.products.map(item=>{
        const p=product(item.id),valid=p&&listed(p)&&inCity(p)&&daysLeft(p)>=0;
        return `<article class="ai-product"><img src="${esc(p?productImage(p):'./assets/images/hero.jpg')}" alt="" /><div><strong>${esc(item.name)}</strong><small>${esc(item.reason)}</small><span>${money(item.price)} <del>${money(item.original)}</del></span></div>${button(icon('arrowUpRight'),'product',`${dataAttr('id',item.id)} aria-label="More details: ${esc(item.name)}"`,'product-detail')}${!valid?'<span class="ai-unavailable">Not available</span>':''}</article>`;
      }).join('')}</div><div class="ai-basket-total"><div><span>Products</span><strong>${money(reply.subtotal)}</strong></div>${reply.fee?`<div><span>Delivery · example</span><strong>${money(reply.fee)}</strong></div>`:''}<div class="ai-total-line"><span>Total for selection</span><strong>${money(reply.total)}</strong></div><small>Saving on products ${money(reply.savings)} · about ${number(reply.weight)} kg</small></div>${button(reply.added?`${icon('check')}Selection in cart`:`${icon('bag')}Add a selection · ${money(reply.subtotal)}`,'add-plan',`${dataAttr('index',index)} ${reply.added?'disabled':''}`,'primary full')}${reply.added?button('Open cart →','cart','','text'):''}`;
    }
    if(reply.recipe)html+=`<div class="ai-recipe"><span>${icon('utensils')}DINNER IDEA</span><h4>${esc(reply.recipe.title)}</h4><ol>${reply.recipe.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><small>${esc(reply.recipe.note)}</small></div>`;
    if(reply.type==='merchant')html+=`<div class="ai-merchant-items">${reply.items.map(item=>`<article class="ai-inventory-tip"><div><strong>${esc(item.name)}</strong><span>Remainder: ${item.remaining} · ${item.days===0?'until the end of the day':`days before the due date: ${item.days}`}</span></div><p>${esc(item.reason)}</p><div class="ai-price-proposal"><span>${money(item.currentPrice)} ${icon('arrowRight')} <strong>${money(item.price)}</strong></span>${button(item.applied?'Applied':item.price===item.currentPrice?'The price is already right':'Apply price','price',`${dataAttr('id',item.id)} ${dataAttr('price',item.price)} ${item.applied||item.price===item.currentPrice?'disabled':''}`,'compact')}</div>${button('View listing →','edit',dataAttr('id',item.id),'text')}</article>`).join('')}</div>`;
    if(reply.type==='bundle')html+=`<ul class="ai-bundle-items">${reply.items.map(i=>`<li>${icon('gift')}<span>${esc(i.name)}</span><b>× ${i.quantity}</b></li>`).join('')}</ul><div class="ai-basket-total"><div><span>Regular price</span><strong>${money(reply.original)}</strong></div><div><span>Set price guide</span><strong>${money(reply.price)}</strong></div></div>`;
    if(reply.type==='ngo'&&reply.lots.length)html+=`<div class="ai-lots">${reply.lots.map((l,i)=>`<article><span class="ai-stop-number">${i+1}</span><div><strong>${esc(l.name)}</strong><small>${esc(l.store)} · up to ${esc(l.expires)}</small><p>${esc(l.pickup)} · up to ${l.remaining} pcs. by ${number(l.weight)} kg</p>${button('Select quantity and date →','claim',dataAttr('id',l.id),'text')}</div></article>`).join('')}</div>`;
    if(reply.stats)html+=`<div class="ai-summary-stats">${reply.stats.map(s=>`<div><strong>${number(s.value)} ${esc(s.unit)}</strong><span>${esc(s.label)}</span></div>`).join('')}</div>`;
    if(reply.steps)html+=`<ol class="ai-checklist">${reply.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`;
    if(reply.destination)html+=button(`${esc(reply.destinationLabel)} ${icon('arrowUpRight')}`,'navigate',`${dataAttr('role',reply.destination.role)} ${dataAttr('tab',reply.destination.tab)}`,'destination');
    if(reply.note)html+=`<p class="ai-answer-note">${icon('info')}<span>${esc(reply.note)}</span></p>`;
    return html;
  }
  function renderConversation() {
    const area=$('#ai-conversation');
    area.innerHTML=history.length?history.map((message,index)=>`<div class="ai-user-message"><span>YOU</span><p>${esc(message.query)}</p></div><article class="ai-answer"><div class="ai-answer-label">${spark}<span>LowS AI</span><small>Local demo</small></div>${renderResponse(message.reply,index)}</article>`).join(''):intro();
  }
  function show(query) {
    if($('#app-dialog').open)return;
    sync();lastFocus=document.activeElement;
    if(!dialog.open){dialog.showModal();document.body.style.overflow='hidden';}
    renderConversation();$('#ai-query').focus({preventScroll:true});
    if(query)send(query);
  }
  function hide(){dialog.close();}
  function send(query) {
    if(!String(query).trim())return;
    sync();const reply=createDemoReply(query,context());
    history.push({id:++serial,query:String(query).trim().slice(0,300),reply});history=history.slice(-6);
    renderConversation();$('#ai-query').value='';
    const area=$('#ai-conversation');area.scrollTop=area.scrollHeight;
    $('#ai-query').focus({preventScroll:true});
  }
  dialog.addEventListener('close',()=>{document.body.style.overflow='';lastFocus?.isConnected&&lastFocus.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)hide();}});
  $('#ai-query-form').addEventListener('submit',event=>{event.preventDefault();const value=$('#ai-query').value;if(value.trim())send(value);else $('#ai-query').focus();});
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-ai]');if(!el||el.disabled)return;
    const action=el.dataset.ai;
    if(action==='open')show();
    if(action==='close')hide();
    if(action==='reset'){history=[];renderConversation();$('#ai-query').focus();}
    if(action==='prompt')send(el.dataset.query);
    if(action==='navigate'){hide();portals?.go(el.dataset.role,el.dataset.tab);}
    if(action==='product'){const p=product(el.dataset.id);if(!p||!listed(p)||!inCity(p)||daysLeft(p)<0)return notify('This offer is no longer available. Request a new selection.');hide();openModal('product',p.id);}
    if(action==='cart'){hide();openModal('cart');}
    if(action==='edit'){hide();portals?.editListing(el.dataset.id);}
    if(action==='claim'){hide();portals?.openClaim(el.dataset.id);}
    if(action==='price'){
      const ok=portals?.applyPrice(el.dataset.id,el.dataset.price);
      if(ok){for(const message of history)if(message.reply.type==='merchant')for(const item of message.reply.items)if(item.id===el.dataset.id)item.applied=true;renderConversation();notify('Recommended price applied to demo offer');}else notify('Price not applied: check the product and access to your account.');
    }
    if(action==='add-plan'){
      const message=history[Number(el.dataset.index)],reply=message?.reply;
      if(!reply||reply.type!=='shopping'||reply.added)return;
      const items=reply.products.map(i=>({item:i,p:product(i.id)}));
      if(items.some(({item,p})=>!p||!listed(p)||!inCity(p)||daysLeft(p)<0||p.price!==item.price||available(p)-(state.cart[p.id]||0)<item.quantity))return notify('Price or availability has changed. Request the selection again.');
      for(const {item,p}of items)state.cart[p.id]=(state.cart[p.id]||0)+item.quantity;
      reply.added=true;save();refresh({modal:false});renderConversation();notify('The selection has been added to cart');
      const again=$(`[data-ai="add-plan"][data-index="${Number(el.dataset.index)}"]`);again?.nextElementSibling?.focus({preventScroll:true});
    }
  });
  window.addEventListener('lows:role-changed',sync);
  window.addEventListener('lows:portal-rendered',sync);
  window.addEventListener('hashchange',()=>{if(dialog.open)hide();sync();});
  sync();
  return {show,context};
}
