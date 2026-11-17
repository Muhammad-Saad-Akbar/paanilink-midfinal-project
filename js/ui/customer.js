import {e,badge,heading,stat,summaryStrip,panel,empty,btn,bookingTable,field,input,select,opts,foot,nameOf,table,tr} from './common.js';
import {cash,dateLabel,localISO} from '../utils/time.js';
import {subsidyMonthUsed,quotaUsed} from '../utils/rules.js';
export const tabs=[{id:'overview',label:'Overview',glyph:'◫'},{id:'new',label:'Book a tanker',glyph:'+'},{id:'bookings',label:'My bookings',glyph:'▤'},{id:'subsidy',label:'Subsidy',glyph:'◇'},{id:'bills',label:'Bills & history',glyph:'▥'}];
const rowActions=b=>[...(['Pending','Approved','Assigned'].includes(b.status)?[btn('Cancel','cancel',b.id,'danger sm')]:[]),...(b.status==='Delivered'?[btn('Confirm','confirm',b.id,'primary sm'),btn('Dispute','dispute',b.id,'secondary sm')]:[])].join('');
function bookingForm(s,u){
 const hydrants=s.hydrants.filter(h=>h.zoneIds.includes(u.zoneId));
 const defaultHydrant=hydrants.find(h=>h.status==='Available')||hydrants[0];
 const today=localISO();
 return panel('Schedule a water tanker',`<form data-form="booking" novalidate><div class="form-grid">
 ${field('Delivery address','address',input('address','text',u.address,'required maxlength="200"'))}
 ${field('Zone','zoneDisplay',input('zoneDisplay','text',nameOf(s,'zones',u.zoneId),'disabled'))}
 ${field('Serving hydrant','hydrantId',select('hydrantId',opts(hydrants.map(h=>({...h,name:`${h.name} (${h.openTime}–${h.closeTime}, ${h.status})`}))),defaultHydrant?.id,'required'))}
 ${field('Tanker capacity','size',select('size',opts(s.rates.map(r=>({id:r.size,name:`${r.size.toLocaleString()} gallons`}))),String(s.rates[0]?.size||''),'required'))}
 ${field('Booking type','type',select('type',[{value:'commercial',label:'Commercial (no approval)'},...(u.subsidyStatus==='Approved'?[{value:'subsidised',label:'Subsidised (officer approval)'}]:[])],'commercial','required'),u.subsidyStatus!=='Approved'?'Apply for and obtain subsidy approval to unlock subsidised bookings.':'Subsidised bookings need Zone Officer approval.')}
 ${field('Delivery date','date',input('date','date',today,`required min="${today}"`))}
 ${field('Requested start time','slotTime',select('slotTime',slotOptions(defaultHydrant,s.config.slotMinutes),'','required'),'Time window lasts 90 minutes. Choose a slot inside hydrant hours.')}
 </div><div id="booking-preview" class="price-preview" aria-live="polite"></div>${foot('Place booking')}</form>`, 'Water is reserved only after approval. Tanker and driver are assigned later by the operator.');
}
export function slotOptions(h,duration=90) {
 if(!h) return [{value:'',label:'No hydrant available'}];
 const n=t=>{const [a,b]=t.split(':').map(Number);return a*60+b;};
 const hh=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
 const items=[];for(let t=n(h.openTime);t+duration<=n(h.closeTime);t+=30) items.push({value:hh(t),label:hh(t)});
 return [{value:'',label:'Select a time'},...items];
}
function subsidyView(s,u){
 const apps=s.applications.filter(a=>a.customerId===u.id).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)));
 const month=subsidyMonthUsed(s,u.id,localISO()),remaining=Math.max(0,u.monthlyLimit-month);
 return `${heading('SUPPORT PROGRAM','Household subsidy','Reduced water rates for verified eligible households.')}
 <div class="stats-grid">${stat('Your eligibility',u.subsidyStatus)}${stat('Monthly allowance',`${remaining} of ${u.monthlyLimit} left`)}${stat('Applications',String(apps.length))}</div>
 ${panel('Subsidy applications',table(['ID','Proof type','Status','Review'],apps.map(a=>tr([e(a.id),e(a.proofType),badge(a.status),e(a.reviewNote||'Awaiting verification')]))))}
 ${!['Pending','Approved'].includes(u.subsidyStatus)?panel('Apply for subsidised status',`<form data-form="subsidy" novalidate><div class="form-grid">
 ${field('Supporting document type','proofType',select('proofType',opts(s.config.proofTypes.map(x=>({id:x,name:x}))),'' ,'required'))}
 ${field('Proof details / reference number','proofReference',input('proofReference','text','','required maxlength="160"'),'Use demonstration data only. Do not upload real identity papers.')}
 ${field('Proof attachment (optional)','proofFile',input('proofFile','file','','accept=".jpg,.jpeg,.png,.pdf"'),'Max 600 KB. Saved only in local demo storage.')}
 </div>${foot('Submit for verification')}</form>`):`<p class="notice">Your subsidy status is <strong>${e(u.subsidyStatus)}</strong>. ${u.subsidyStatus==='Approved'?'You may now request subsidised tankers.':'Wait for your zone officer to review your submitted proof.'}</p>`}`;
}
export function view(s,u,tab){
 const bookings=s.bookings.filter(b=>b.customerId===u.id).sort((a,b)=>b.date.localeCompare(a.date));
 const active=bookings.filter(b=>!['Confirmed','Cancelled','Rejected','Failed','Disputed'].includes(b.status));
 const completed=bookings.filter(b=>['Delivered','Confirmed'].includes(b.status));
 if(tab==='new') return heading('NEW REQUEST','Book a tanker','Choose your delivery slot and water capacity.')+bookingForm(s,u);
 if(tab==='subsidy') return subsidyView(s,u);
 if(tab==='bookings') return `${heading('MY REQUESTS','Booking history','Track each booking from request to customer confirmation.')}${panel('All my bookings',bookingTable(s,bookings,{actions:rowActions}))}`;
 if(tab==='bills')return `${heading('FINANCIAL RECORD','Bills & history','Invoice amounts are calculated from saved booking rates.')}${panel('Booking invoices',table(['Invoice','Date','Capacity','Rate type','Amount','Status','Open'],bookings.map(b=>tr([e(`INV-${b.id}`),e(dateLabel(b.date)),`${b.size.toLocaleString()} gal`,e(b.type),`<strong>${e(cash(b.amount))}</strong>`,badge(b.status),btn('View bill','bill',b.id,'ghost sm')]))))}`;
 return `${heading('CUSTOMER PORTAL',`Welcome back, ${u.name.split(' ')[0]}`,'Manage water deliveries without the guesswork.')}
 ${summaryStrip([['Total bookings',String(bookings.length),'Your requests to date'],['In progress',String(active.length),'Upcoming and active'],['Completed',String(completed.length),'Delivered / confirmed'],['Subsidy',u.subsidyStatus,'Household eligibility']])}
 <div class="quick-action"><div><span class="eyebrow">NEED WATER?</span><h2>Your next delivery starts here.</h2><p>Choose a capacity, compare the price and track the tanker through every step.</p></div><button type="button" data-tab="new" class="btn primary">Book a tanker →</button></div>
 ${panel('Recent requests',bookingTable(s,bookings.slice(0,5),{actions:rowActions}), 'View status, assigned tanker and full timeline.', '<button class="btn ghost sm" data-tab="bookings">View all →</button>')}`;
}
export function updatePricePreview(s,form){
 if(!form)return;
 const size=Number(form.elements.size?.value),type=form.elements.type?.value,hid=form.elements.hydrantId?.value;
 const rate=s.rates.find(r=>r.size===size),hyd=s.hydrants.find(h=>h.id===hid);
 const amount=rate?.[type],used=hyd?quotaUsed(s,hyd.id,form.elements.date?.value):0;
 const el=form.querySelector('#booking-preview');if(!el)return;
 el.innerHTML=`<span>Estimated booking cost <strong>${e(cash(amount||0))}</strong></span><span>Daily quota free <strong>${hyd?Math.max(0,hyd.quotaDaily-used).toLocaleString():'—'} gal</strong></span>`;
}
