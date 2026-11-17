// Local label OCR and a conservative, user-confirmed date check. No vision diagnosis.
export function extractLabelDates(text) {
  const found = new Map();
  const add = (year, month, day, label) => {
    const y=Number(year),m=Number(month),d=Number(day);
    if(y<2000||y>2099||m<1||m>12||d<1||d>31)return;
    const date=new Date(y,m-1,d);
    if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return;
    const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    found.set(iso,{date:iso,label});
  };
  const value=String(text||'').slice(0,20000);
  for(const match of value.matchAll(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/g))add(match[1],match[2],match[3],match[0]);
  // Regional packaging commonly uses day/month/year. Confirmation remains mandatory.
  for(const match of value.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/g))add(match[3].length===2?`20${match[3]}`:match[3],match[2],match[1],`${match[0]} (day/month/year)`);
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for(const match of value.matchAll(/\b(\d{1,2})[\s./-]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,./-]+(20\d{2})\b/gi))add(match[3],months.indexOf(match[2].slice(0,3).toLowerCase())+1,match[1],match[0]);
  return [...found.values()];
}

export function assessFoodDate({date,labelType,confirmed,storage,appearance},today=new Date()) {
  if(appearance==='concern')return {tone:'danger',title:'Do not use a product with concerning signs',text:'You reported mould, unusual changes or damaged packaging. A date check cannot override these concerns. Do not taste food to test it.'};
  if(!confirmed||!['use-by','best-before'].includes(labelType)||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return {tone:'warning',title:'Confirm the printed date and label type',text:'OCR can confuse a production date, batch code and expiry date. Match the date to the original label before continuing.'};
  const [y,m,d]=date.split('-').map(Number),expiry=new Date(y,m-1,d);
  if(expiry.getFullYear()!==y||expiry.getMonth()!==m-1||expiry.getDate()!==d)return {tone:'warning',title:'Check the date again',text:'Enter a complete, valid date from the label.'};
  const current=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const diff=Math.round((Date.UTC(y,m-1,d)-Date.UTC(current.getFullYear(),current.getMonth(),current.getDate()))/86400000);
  if(diff<0&&labelType==='use-by')return {tone:'danger',title:'The use-by date has passed',text:'Do not eat food after its use-by date, even if it looks or smells normal. This photo does not establish safety.'};
  if(storage!=='followed')return {tone:'warning',title:'Storage conditions need checking',text:'The printed date assumes the stated storage conditions. Incorrect or unknown storage, and instructions after opening, can make that date insufficient. This check cannot confirm safety.'};
  if(diff<0)return {tone:'warning',title:'The best-before date has passed',text:'Best-before describes quality, not a guarantee of safety. Review the product instructions, packaging and condition. This result is not permission to eat it.'};
  return {tone:'neutral',title:diff===0?'The printed date is today':'The printed date has not passed',text:`${diff===0?'Today is the date you confirmed.':`${diff} day${diff===1?'':'s'} remain until the date you confirmed.`} This is a label-date comparison, not a freshness or safety certificate. Follow storage and after-opening instructions.`};
}

export function initFoodCheck({beforeOpen=()=>{},icon=()=>''}={}) {
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const camera='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg>';
  document.querySelector('.ai-discovery')?.insertAdjacentHTML('afterend',`<button class="foodscan-entry" data-foodcheck="open">${camera}<span><strong>Scan food</strong><small>Take a photo. Read the label. Check the date.</small></span><span aria-hidden="true">↗</span></button>`);
  document.querySelector('.ai-panel-bottom')?.insertAdjacentHTML('afterbegin',`<button class="foodscan-assistant-entry" data-foodcheck="open">${camera}<span>Check a product photo</span><small>Label OCR</small></button>`);
  document.body.insertAdjacentHTML('beforeend',`<dialog id="foodcheck-dialog" class="foodcheck-dialog" aria-labelledby="foodcheck-title"><header class="foodcheck-header"><span class="foodcheck-symbol">${camera}</span><div><small>LOWS AI · PHOTO CHECK</small><h2 id="foodcheck-title">A closer look at your food</h2></div><button type="button" data-foodcheck="close" aria-label="Close photo check">${icon('close')||'×'}</button></header><div class="foodcheck-content"><p class="foodcheck-intro">Photograph the date label in good light. Text recognition runs on your device; your photo is not uploaded or saved.</p><div class="foodcheck-pickers"><button class="button primary" data-foodcheck="camera">${camera}Take a photo</button><button class="button" data-foodcheck="upload">Choose a photo</button></div><input id="foodcheck-camera" class="sr-only" type="file" accept="image/*" capture="environment" aria-label="Take a product photo" /><input id="foodcheck-upload" class="sr-only" type="file" accept="image/*" aria-label="Choose a product photo" /><div id="foodcheck-photo" hidden><img id="foodcheck-preview" alt="Your selected product label" /><button class="text-button" data-foodcheck="remove">Remove photo</button></div><div class="foodcheck-tools"><button id="foodcheck-read" class="button primary" data-foodcheck="read" disabled>Read date from photo</button><button id="foodcheck-cancel" class="text-button" data-foodcheck="cancel" hidden>Cancel recognition</button></div><p id="foodcheck-status" role="status" aria-live="polite">You can also enter the printed date manually below.</p><p class="foodcheck-download">First scan downloads OCR files and English/Russian language data. Internet is needed for that download. Photos stay on this device.</p><div id="foodcheck-recognition" hidden><label for="foodcheck-text">Recognized label text</label><textarea id="foodcheck-text" rows="3" readonly></textarea><div id="foodcheck-dates" class="foodcheck-dates"></div><p>Dates are suggestions, not confirmed expiry dates. Numeric dates use day/month/year; check the order on your packaging.</p></div><form id="foodcheck-form"><div class="foodcheck-fields"><label>Date printed on the label<input id="foodcheck-date" type="date" required /></label><label>What does this date mean?<select id="foodcheck-type" required><option value="">Choose the label type</option><option value="use-by">Use by / expiry date</option><option value="best-before">Best before</option></select></label></div><label class="foodcheck-confirm"><input id="foodcheck-confirm" type="checkbox" required /><span>I checked this is the use-by or best-before date, not the production date or batch number.</span></label><label>Storage and after-opening instructions<select id="foodcheck-storage"><option value="unknown">Unknown / not checked</option><option value="followed">I checked and followed all instructions</option><option value="not-followed">Storage instructions were not followed</option></select></label><details class="foodcheck-appearance"><summary>Check the appearance</summary><p>No visual AI model is connected. Review the photo yourself for mould, unusual changes, or damaged / swollen packaging. A normal appearance cannot confirm safety.</p><label>What do you notice?<select id="foodcheck-appearance"><option value="unknown">Not sure / not checked</option><option value="none">No obvious concerns noticed</option><option value="concern">Mould, unusual changes or damaged packaging</option></select></label></details><button class="button primary full-width" type="submit">Check confirmed date</button></form><section id="foodcheck-result" class="foodcheck-result" role="status" aria-live="polite" hidden></section><p class="foodcheck-limit">A photo cannot detect harmful bacteria or confirm that food is safe. <a href="https://www.food.gov.uk/safety-hygiene/best-before-and-use-by-dates" target="_blank" rel="noopener noreferrer">About use-by and best-before dates ↗</a></p></div></dialog>`);
  const $=s=>document.querySelector(s),dialog=$('#foodcheck-dialog');
  let photo=null,url=null,worker=null,run=0,lastFocus=null,busy=false;
  const status=text=>{$('#foodcheck-status').textContent=text;};
  const clearResult=()=>{$('#foodcheck-result').hidden=true;};
  function setBusy(value){busy=value;$('#foodcheck-read').disabled=value||!photo;$('#foodcheck-cancel').hidden=!value;}
  function cancel(){run++;const current=worker;worker=null;if(current)Promise.resolve(current.terminate()).catch(()=>{});setBusy(false);}
  function removePhoto(){cancel();photo=null;if(url)URL.revokeObjectURL(url);url=null;$('#foodcheck-preview').removeAttribute('src');$('#foodcheck-photo').hidden=true;$('#foodcheck-recognition').hidden=true;$('#foodcheck-text').value='';$('#foodcheck-dates').replaceChildren();$('#foodcheck-camera').value='';$('#foodcheck-upload').value='';setBusy(false);clearResult();}
  function reset(){removePhoto();$('#foodcheck-form').reset();status('You can also enter the printed date manually below.');}
  function open(){if(dialog.open)return;beforeOpen();if(document.querySelector('#app-dialog[open]'))return;lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden';}
  async function pick(file){
    removePhoto();$('#foodcheck-date').value='';$('#foodcheck-confirm').checked=false;
    if(!file)return;
    if(!/^image\//.test(file.type))return status('Choose an image file, such as JPEG, PNG or WebP.');
    if(file.size>15*1024*1024)return status('This image is too large. Choose a photo smaller than 15 MB.');
    photo=file;url=URL.createObjectURL(file);$('#foodcheck-preview').src=url;$('#foodcheck-photo').hidden=false;setBusy(false);status('Photo ready. Read the label or enter its date manually.');
  }
  $('#foodcheck-preview').addEventListener('error',()=>{removePhoto();status('This image format cannot be opened here. Try a JPEG photo or enter the date manually.');});
  function loadOCR(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./assets/vendor/tesseract/tesseract.min.js',import.meta.url).href;script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR unavailable'));script.onerror=()=>{script.remove();reject(new Error('OCR unavailable'));};document.head.append(script);});
  }
  async function prepareImage(file) {
    if(!window.createImageBitmap)return file;
    let bitmap;
    try{
      bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
      if(scale===1)return file;
      const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      return await new Promise(resolve=>canvas.toBlob(blob=>resolve(blob||file),'image/jpeg',.92));
    }finally{bitmap?.close();}
  }
  async function read(){
    if(!photo||busy)return;
    const current=++run,file=photo;let timeout,ownWorker=null;
    $('#foodcheck-recognition').hidden=true;$('#foodcheck-date').value='';$('#foodcheck-confirm').checked=false;clearResult();setBusy(true);status('Loading on-device text recognition…');
    try{
      const task=(async()=>{
        const image=await prepareImage(file);if(current!==run)return;
        const OCR=await loadOCR();if(current!==run)return;
        ownWorker=await OCR.createWorker('eng+rus',1,{workerPath:new URL('./assets/vendor/tesseract/worker.min.js',import.meta.url).href,corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',logger:event=>{if(current===run&&event.status==='recognizing text')status(`Reading the label… ${Math.round((event.progress||0)*100)}%`);}});
        if(current!==run){await ownWorker.terminate();ownWorker=null;return;}worker=ownWorker;
        const result=await ownWorker.recognize(image);if(current!==run)return;
        const text=String(result.data.text||'').trim().slice(0,20000),dates=extractLabelDates(text);
        $('#foodcheck-text').value=text;$('#foodcheck-recognition').hidden=!text;
        $('#foodcheck-dates').innerHTML=dates.map(d=>`<button type="button" data-foodcheck="date" data-date="${d.date}">${esc(d.label)} → ${d.date}</button>`).join('');
        status(dates.length?'Possible dates found. Select the correct expiry date, then confirm it against the label.':'No complete date found. Retake a clear close-up or enter the date manually.');
      })();
      await Promise.race([task,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Timed out')),60000);})]);
    }catch{if(current===run){run++;status('Could not read this label. Check your connection, try a clearer photo, or enter the date manually.');}}
    finally{clearTimeout(timeout);if(ownWorker)await Promise.resolve(ownWorker.terminate()).catch(()=>{});if(worker===ownWorker)worker=null;if(current===run||current+1===run)setBusy(false);}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-foodcheck]');if(!button)return;
    const action=button.dataset.foodcheck;
    if(action==='open')open();
    if(action==='close')dialog.close();
    if(action==='camera')$('#foodcheck-camera').click();
    if(action==='upload')$('#foodcheck-upload').click();
    if(action==='read')read();
    if(action==='remove'){removePhoto();status('Photo removed. You can enter the label date manually.');}
    if(action==='cancel'){cancel();status('Recognition cancelled. Enter the date manually or try again.');}
    if(action==='date'){$('#foodcheck-date').value=button.dataset.date;$('#foodcheck-confirm').checked=false;clearResult();$('#foodcheck-date').focus();}
  });
  for(const id of ['camera','upload'])$(`#foodcheck-${id}`).addEventListener('change',event=>pick(event.target.files?.[0]));
  $('#foodcheck-form').addEventListener('input',event=>{clearResult();if(event.target.id==='foodcheck-date'||event.target.id==='foodcheck-type')$('#foodcheck-confirm').checked=false;});
  $('#foodcheck-form').addEventListener('submit',event=>{
    event.preventDefault();
    const result=assessFoodDate({date:$('#foodcheck-date').value,labelType:$('#foodcheck-type').value,confirmed:$('#foodcheck-confirm').checked,storage:$('#foodcheck-storage').value,appearance:$('#foodcheck-appearance').value});
    const target=$('#foodcheck-result');target.className=`foodcheck-result ${result.tone}`;target.innerHTML=`<h3>${esc(result.title)}</h3><p>${esc(result.text)}</p>`;target.hidden=false;target.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  dialog.addEventListener('close',()=>{reset();document.body.style.overflow='';lastFocus?.isConnected&&lastFocus.focus({preventScroll:true});});
  window.addEventListener('pagehide',reset);
  return {open,reset};
}
