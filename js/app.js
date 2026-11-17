import {getBootstrap,login,action,logout,resetDemo,mockMode} from './api/api.js';
import {getSession,setSession,signOut,roleURL,rolePaths} from './utils/auth.js';
import {checkRegistration,validateBooking,validateProof,validCNIC,validPhone,validEmail} from './utils/rules.js';
import {e,field,input,select,opts,foot,shell,empty} from './ui/common.js';
import {modalFor} from './ui/modals.js';
import * as customer from './ui/customer.js';
import * as officer from './ui/officer.js';
import * as operator from './ui/operator.js';
import * as driver from './ui/driver.js';
import * as admin from './ui/admin.js';
const modules={'Customer':customer,'Zone Officer':officer,'Hydrant Operator':operator,'Driver':driver,'Administrator':admin};
const page=document.body.dataset.page||'auth',root=document.getElementById('app-root');
let session=getSession(),store=null,user=null,tab=null,authTab='login',toastTimeout;
const errorBox=(message)=>`<div class="error-banner" role="alert"><strong>Something went wrong.</strong><p>${e(message)}</p><button type="button" class="btn secondary" data-retry>Try again</button></div>`;
const loading=()=>`<div class="boot-loader" role="status" aria-live="polite"><div class="loader"></div><p>Loading PaaniLink…</p></div>`;
const tabsFor=()=>modules[user.role].tabs;
function urlTab(){return new URLSearchParams(location.search).get('tab');}
function setTab(next){tab=tabsFor().some(x=>x.id===next)?next:'overview';history.replaceState(null,'',`?tab=${encodeURIComponent(tab)}`);render();}
function render(){if(!user||!store)return;root.innerHTML=shell(store,user,page,tab,tabsFor(),modules[user.role].view(store,user,tab));
 if(user.role==='Customer'&&tab==='new')customer.updatePricePreview(store,root.querySelector('form[data-form="booking"]'));}
function notify(text,type='success'){
 let box=document.getElementById('toast');if(!box){box=document.createElement('div');box.id='toast';document.body.append(box);}
 box.className=`toast ${type}`;box.textContent=text;box.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.hidden=true,5000);
}
function go(role,fromRoot=true){location.href=roleURL(role,fromRoot);}
function authView(){
 const demo=(store.users||[]).filter(u=>['Customer','Zone Officer','Hydrant Operator','Driver','Administrator'].includes(u.role)).filter((u,i,arr)=>arr.findIndex(x=>x.role===u.role)===i);
 const top=`<div class="auth-brand"><span class="brand-mark">◈</span><span>Paani<span>Link</span></span></div><div class="auth-tabs" role="group" aria-label="Authentication"><button class="${authTab==='login'?'active':''}" data-auth-switch="login" type="button">Log in</button><button class="${authTab==='register'?'active':''}" data-auth-switch="register" type="button">Create account</button></div>`;
 const loginForm=`<form data-form="login" novalidate>${field('Email address','email',input('email','email','','autocomplete="username" required placeholder="you@example.com"'))}${field('Password','password',input('password','password','','autocomplete="current-password" required'))}${foot('Log in →')}</form>`;
 const registerForm=`<form data-form="register" novalidate><div class="form-grid">${field('Full name','name',input('name','text','','required autocomplete="name"'))}${field('Email address','email',input('email','email','','required autocomplete="email"'))}${field('Password','password',input('password','password','','required minlength="6" autocomplete="new-password"'))}${field('CNIC (13 digits)','cnic',input('cnic','text','','required inputmode="numeric" maxlength="13" placeholder="4210112345671"'))}${field('Pakistani phone','phone',input('phone','tel','','required placeholder="03XXXXXXXXX"'))}${field('Customer category','customerType',select('customerType',opts(store.config.customerCategories.map(x=>({id:x,name:x}))),'','required'))}${field('Service zone','zoneId',select('zoneId',opts(store.zones),'','required'))}${field('Home / delivery address','address',input('address','text','','required maxlength="200"'))}</div>${foot('Create customer account →')}</form>`;
 root.innerHTML=`<div class="auth-layout"><aside class="auth-art"><div class="auth-art-top">CITY WATER BOARD <span> / DIGITAL SERVICES</span></div><div class="auth-art-main"><div class="auth-symbol">◈</div><span class="eyebrow">A SMARTER WATER NETWORK</span><h1>Every drop.<br>Every route.<br><em>Accounted for.</em></h1><p>One connected system for tanker requests, hydrant dispatch, and delivery confirmation across the city.</p></div><div class="auth-art-bottom"><span>01 / BOOKINGS</span><span>02 / DISPATCH</span><span>03 / CONFIRMATION</span></div></aside>
 <main class="auth-form-area"><div class="auth-form-wrap">${top}<p class="eyebrow">${authTab==='login'?'SECURE WORKSPACE':'JOIN THE NETWORK'}</p><h2>${authTab==='login'?'Sign in to your workspace':'Create a customer account'}</h2><p class="muted">${authTab==='login'?'Your access and dashboard depend on your assigned role.':'Use demo details for Phase 1; avoid real CNIC or identity documents.'}</p>
 ${authTab==='login'?loginForm:registerForm}
 ${authTab==='login'&&mockMode?`<div class="demo-accounts"><p class="eyebrow">QUICK DEMO ACCESS</p><p>Choose any role. Password for every demo account: <code>demo123</code></p><div class="demo-buttons">${demo.map(u=>`<button class="demo-role" type="button" data-demo-email="${e(u.email)}"><span>${e(u.role)}</span><span>↗</span></button>`).join('')}</div></div>`:''}
 <p class="auth-footer">Frontend prototype · ${e(store.config.city)} Water Board</p></div></main></div>`;
}
function showModal(command,id){if(!store||!user)return;const result=modalFor(store,user,command,id);if(!result)return notify('This action is not available for your role or this status.','error');
 const dialog=document.getElementById('app-dialog');if(!dialog)return;
 dialog.querySelector('#dialog-content').innerHTML=`<div class="dialog-header"><h2 id="dialog-heading">${e(result.title)}</h2><button type="button" class="dialog-close" data-close aria-label="Close dialog">✕</button></div><div class="dialog-body">${result.body}</div>`;
 dialog.showModal();dialog.querySelector('input:not([type="hidden"]),select,textarea,button')?.focus();
}
function gather(form){const f=new FormData(form),data=Object.fromEntries(f.entries());if(form.dataset.kind==='hydrant')data.zoneIds=f.getAll('zoneIds');return data;}
function showFieldErrors(form,fields={}){
 form.querySelectorAll('[data-error]').forEach(x=>x.textContent='');
 form.querySelectorAll('.field.invalid').forEach(x=>x.classList.remove('invalid'));
 const entries=Object.entries(fields);for(const [name,message] of entries){
  const el=form.querySelector(`[data-error="${CSS.escape(name)}"]`);if(el){el.textContent=message;el.closest('.field')?.classList.add('invalid');}
 }
 const first=entries.map(([k])=>form.elements.namedItem(k)).find(Boolean);if(first?.focus)first.focus();
}
function fieldValidation(form){const errs={};
 for(const el of form.querySelectorAll('input,select,textarea')){
  if(el.type==='hidden'||el.disabled||el.type==='file'||el.type==='checkbox')continue;
  if(el.required&&!String(el.value||'').trim())errs[el.name]='This field is required.';
  else if(el.type==='email'&&el.value&&!validEmail(el.value))errs[el.name]='Enter a valid email.';
  else if(el.type==='number'&&el.value&&(!Number.isFinite(Number(el.value))||el.min&&Number(el.value)<Number(el.min)))errs[el.name]='Enter a valid positive number.';
 }
 if(form.elements.cnic?.value&&!validCNIC(form.elements.cnic.value))errs.cnic='CNIC needs exactly 13 digits.';
 if(form.elements.phone?.value&&!validPhone(form.elements.phone.value))errs.phone='Use a Pakistani phone format such as 03001234567.';
 if(form.elements.password?.value&&form.elements.password.value.length<6)errs.password='At least 6 characters required.';
 return errs;
}
async function readProofFile(file){
 if(!file)return {proofName:'',proofDataUrl:''};
 if(!['image/jpeg','image/png','application/pdf'].includes(file.type))throw Object.assign(new Error('Use PDF, JPG or PNG only.'),{fields:{proofFile:'Invalid file type.'}});
 if(file.size>600000)throw Object.assign(new Error('Attachment must be 600 KB or smaller.'),{fields:{proofFile:'File must be 600 KB or less.'}});
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Cannot read attached file.'));reader.readAsDataURL(file);});
 return {proofName:file.name,proofDataUrl:data};
}
async function submit(form){
 const data=gather(form),type=form.dataset.form,actor=session,errors=fieldValidation(form);
 if(Object.keys(errors).length){showFieldErrors(form,errors);return;}
 const submitButton=form.querySelector('[type="submit"]');if(submitButton){submitButton.disabled=true;submitButton.dataset.oldText=submitButton.textContent;submitButton.textContent='Saving…';}
 try{
  if(type==='login'){
   const result=await login(data.email,data.password);setSession(result.user);go(result.user.role);return;
  }
  if(type==='register'){
   checkRegistration(store,data);const result=await action('customer.register',data,null);setSession(result);go('Customer');return;
  }
  if(type==='booking'){
    validateBooking(store,user,data);await action('booking.create',data,actor);setTab('bookings');
  }else if(type==='subsidy'){
    const file=form.elements.proofFile?.files[0];Object.assign(data,await readProofFile(file));validateProof(data);await action('subsidy.apply',data,actor);
  }else if(type==='reviewBooking'){
    await action('booking.review',{bookingId:form.dataset.bookingId,decision:form.dataset.decision,note:data.note},actor);
  }else if(type==='reviewApplication'){
    await action('subsidy.review',{applicationId:form.dataset.applicationId,decision:form.dataset.decision,note:data.note},actor);
  }else if(type==='resolveDispute'){
    await action('dispute.resolve',{disputeId:form.dataset.disputeId,resolution:data.resolution},actor);
  }else if(type==='dispute'){
    await action('booking.dispute',{bookingId:form.dataset.bookingId,reason:data.reason},actor);
  }else if(type==='assign'){
    await action('dispatch.assign',{bookingId:form.dataset.bookingId,tankerId:data.tankerId,driverId:data.driverId},actor);
  }else if(type==='fail'){
    await action('trip.fail',{bookingId:form.dataset.bookingId,reason:`${data.reason}${data.extra?` • ${data.extra}`:''}`},actor);
  }else if(type==='instant'){
    const payload={...form.dataset};delete payload.form;delete payload.type;
    await action(form.dataset.type,payload,actor);
  }else if(type==='adminUpsert'){
    if(form.dataset.kind==='rate')data.size=Number(form.dataset.id);
    else if(form.dataset.id)data.id=form.dataset.id;
    await action('admin.upsert',{kind:form.dataset.kind,data},actor);
  }else if(type==='adminDelete'){
    await action('admin.delete',{kind:form.dataset.kind,id:form.dataset.id},actor);
  }else{return;}
  document.getElementById('app-dialog')?.close();
  store=await getBootstrap();user=store.users.find(x=>x.id===session.userId);render();notify('Saved successfully. The updated record is now visible.');
 }catch(err){
  showFieldErrors(form,err.fields||{});
  const old=form.querySelector('.form-error-summary');old?.remove();
  const box=document.createElement('p');box.className='form-error-summary';box.role='alert';box.textContent=err.message||'Action failed. Try again.';
  form.prepend(box);notify(err.message||'Action failed.','error');
 }finally{if(submitButton&&submitButton.isConnected){submitButton.disabled=false;submitButton.textContent=submitButton.dataset.oldText||'Submit';}}
}
function handleChange(event){
 if(event.target.matches('form[data-form="booking"] [name="hydrantId"]')){
  const form=event.target.form,hyd=store.hydrants.find(h=>h.id===event.target.value),slots=customer.slotOptions(hyd,store.config.slotMinutes),selectEl=form.elements.slotTime;
  selectEl.innerHTML=slots.map(x=>`<option value="${e(x.value)}">${e(x.label)}</option>`).join('');
 }
 if(event.target.closest('form[data-form="booking"]'))customer.updatePricePreview(store,event.target.form);
}
async function boot(){
 root.innerHTML=loading();
 if(page!=='auth'){
  if(!session||!rolePaths[session.role]){location.replace('../index.html');return;}
  if(rolePaths[session.role]!==`${page}.html`){location.replace(roleURL(session.role));return;}
 }
 try{
  store=await getBootstrap();
  if(page==='auth'){authView();return;}
  user=store.users.find(u=>u.id===session.userId && u.role===session.role && u.status==='Active');
  if(!user){sessionStorage.removeItem('paanilink:session');location.replace('../index.html');return;}
  tab=modules[user.role].tabs.some(x=>x.id===urlTab())?urlTab():'overview';render();
 }catch(err){root.innerHTML=errorBox(err.message||'Could not reach mock data. Use a local web server, not file://.');}
}
// Viva trace: click -> choose role/status-aware modal -> submit -> API action
// -> load updated Fetch/local snapshot -> rebuild only data-driven UI.
root?.addEventListener('click',async ev=>{
 const button=ev.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-retry')){boot();return;}
 if(button.hasAttribute('data-logout')){try{await logout();}catch{}signOut();return;}
 if(button.dataset.tab){setTab(button.dataset.tab);return;}
 if(button.dataset.authSwitch){authTab=button.dataset.authSwitch;authView();return;}
 if(button.dataset.demoEmail){const email=root.querySelector('[name="email"]'),pass=root.querySelector('[name="password"]');if(email&&pass){email.value=button.dataset.demoEmail;pass.value='demo123';email.focus();notify(`Demo selected. Select Log in to continue.`);}return;}
 if(button.dataset.open){showModal(button.dataset.open,button.dataset.id);return;}
 if(button.hasAttribute('data-close')){button.closest('dialog')?.close();return;}
 if(button.hasAttribute('data-print')){window.print();return;}
 if(button.hasAttribute('data-reset')){await resetDemo();store=await getBootstrap();render();notify('Demo data reset.');}
});
root?.addEventListener('submit',event=>{event.preventDefault();submit(event.target);});
root?.addEventListener('change',handleChange);
root?.addEventListener('input',ev=>{const form=ev.target.form,field=form?.querySelector(`[data-error="${CSS.escape(ev.target.name||'')}"]`);if(field){field.textContent='';field.closest('.field')?.classList.remove('invalid');}});
boot();
