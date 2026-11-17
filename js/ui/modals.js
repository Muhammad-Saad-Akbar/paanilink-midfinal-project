import {e,field,input,select,textArea,opts,foot,bookingDetail,nameOf,badge} from './common.js';
import {eligibleTankers,eligibleDrivers} from '../utils/rules.js';
import {cash,dateLabel} from '../utils/time.js';
const form=(kind,fields,label,data={})=>`<form data-form="${e(kind)}" ${Object.entries(data).map(([k,v])=>`data-${e(k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`))}="${e(v)}"`).join(' ')} novalidate>${fields}${foot(label)}</form>`;
const note=(label='Review note (optional)')=>field(label,'note',textArea('note','', 'maxlength="400"'));
const message=(text)=>`<p class="dialog-lead">${e(text)}</p>`;
const choice=(label,name,items,value='',attrs='')=>field(label,name,select(name,opts(items),value,attrs));
export function modalFor(s,u,command,id){
 const b=s.bookings.find(x=>x.id===id), a=s.applications.find(x=>x.id===id), d=s.disputes.find(x=>x.id===id);
 const owns=b && (u.role==='Administrator'||u.role==='Customer'&&b.customerId===u.id||u.role==='Zone Officer'&&b.zoneId===u.zoneId||u.role==='Hydrant Operator'&&b.hydrantId===u.hydrantId||u.role==='Driver'&&b.driverId===u.id);
 if(command==='detail'&&owns)return {title:'Booking details',body:bookingDetail(s,b,u)};
 if(command==='bill'&&owns&&u.role==='Customer')return {title:`Invoice • ${b.id}`,body:`<div class="invoice"><div class="invoice-brand">◈ PAANILINK</div><p>City Water Board · Demo invoice</p><hr><dl class="definition-grid"><div><dt>Invoice</dt><dd>INV-${e(b.id)}</dd></div><div><dt>Customer</dt><dd>${e(u.name)}</dd></div><div><dt>Service date</dt><dd>${e(dateLabel(b.date))}</dd></div><div><dt>Water capacity</dt><dd>${b.size.toLocaleString()} gal</dd></div><div><dt>Booking rate</dt><dd>${e(b.type)}</dd></div><div><dt>Current status</dt><dd>${badge(b.status)}</dd></div></dl><h2 class="invoice-total">${e(cash(b.amount))}</h2><p class="hint">This is a cost record, not a payment receipt. Payment integration is outside Phase 1.</p><button class="btn secondary" type="button" data-print>Print invoice</button></div>`};
 if(['cancel','confirm','dispute'].includes(command)&&owns&&u.role==='Customer'){
  if(command==='cancel'&&['Pending','Approved','Assigned'].includes(b.status))return {title:'Cancel booking',body:form('instant',message(`Cancel ${b.id}? This cannot be undone.`),'Cancel booking',{type:'booking.cancel',bookingId:b.id})};
  if(command==='confirm'&&b.status==='Delivered')return {title:'Confirm delivery',body:form('instant',message(`Confirm ${b.size.toLocaleString()} gallons were delivered for ${b.id}.`),'Confirm received',{type:'booking.confirm',bookingId:b.id})};
  if(command==='dispute'&&b.status==='Delivered')return {title:'Report delivery problem',body:form('dispute',message(`Explain the problem with ${b.id}. Your Zone Officer will review it.`)+field('What went wrong?','reason',textArea('reason','','required maxlength="400"')),'File dispute',{bookingId:b.id})};
 }
 if(['approve-booking','reject-booking'].includes(command)&&u.role==='Zone Officer'&&b?.zoneId===u.zoneId&&b.type==='subsidised'&&b.status==='Pending'){
   const decision=command==='approve-booking'?'Approved':'Rejected';return {title:`${decision} subsidised booking`,body:form('reviewBooking',message(`${b.id} • ${b.size.toLocaleString()} gal • ${dateLabel(b.date)} • ${cash(b.amount)}`)+note(),'Save decision',{bookingId:b.id,decision})};
 }
 if(['approve-app','reject-app'].includes(command)&&u.role==='Zone Officer'&&a?.status==='Pending'){
  const customer=s.users.find(x=>x.id===a.customerId);if(customer?.zoneId!==u.zoneId)return null;
  const decision=command==='approve-app'?'Approved':'Rejected';return {title:`${decision} subsidy application`,body:form('reviewApplication',message(`${customer.name} submitted ${a.proofType} (${a.proofReference})${a.proofName?` • Attachment: ${a.proofName}`:''}.`)+note(),'Save decision',{applicationId:a.id,decision})};
 }
 if(command==='resolve-dispute'&&u.role==='Zone Officer'&&d?.status==='Open'){
  const bk=s.bookings.find(x=>x.id===d.bookingId);if(bk?.zoneId!==u.zoneId)return null;
  return {title:'Resolve dispute',body:form('resolveDispute',message(`${d.bookingId}: ${d.reason}`)+field('Resolution / outcome','resolution',textArea('resolution','','required maxlength="500"')),'Close dispute',{disputeId:d.id})};
 }
 if(command==='assign'&&u.role==='Hydrant Operator'&&b?.hydrantId===u.hydrantId&&b.status==='Approved'){
  const tankers=eligibleTankers(s,b).map(t=>({id:t.id,name:`${t.plate} (${t.size.toLocaleString()} gal)`}));
  const drivers=eligibleDrivers(s,b).map(x=>({id:x.id,name:x.name}));
  return {title:`Dispatch ${b.id}`,body:form('assign',message(`Select an available ${b.size.toLocaleString()}-gallon tanker and driver for ${dateLabel(b.date)} at ${b.slotTime}.`)+
    choice('Tanker','tankerId',tankers,'','required')+choice('Driver','driverId',drivers,'','required')+
    ((!tankers.length||!drivers.length)?`<p class="notice warning">No compatible ${!tankers.length?'tanker ':''}${!drivers.length?'driver':''} available for this time window.</p>`:''),'Assign resources',{bookingId:b.id})};
 }
 if(command==='fill'&&u.role==='Hydrant Operator'&&b?.hydrantId===u.hydrantId&&b.status==='Assigned')return {title:'Record fill & departure',body:form('instant',message(`${b.id}: confirm water loaded at your hydrant and tanker departed.`),'Record filled & departed',{type:'dispatch.fill',bookingId:b.id})};
 if(command==='toggle-tanker'&&u.role==='Hydrant Operator'){
  const t=s.tankers.find(t=>t.id===id);if(t?.hydrantId!==u.hydrantId)return null;
  return {title:'Update tanker availability',body:form('instant',message(`Set ${t.plate} to ${t.status==='Available'?'Unavailable':'Available'}?`),'Update status',{type:'dispatch.tankerAvailability',tankerId:t.id,status:t.status==='Available'?'Unavailable':'Available'})};
 }
 if(command==='toggle-hydrant'&&u.role==='Hydrant Operator'){
  const h=s.hydrants.find(h=>h.id===id);if(h?.id!==u.hydrantId)return null;
  return {title:'Update hydrant status',body:form('instant',message(`Set ${h.name} to ${h.status==='Available'?'Unavailable':'Available'}?`),'Update status',{type:'dispatch.hydrantAvailability',status:h.status==='Available'?'Unavailable':'Available'})};
 }
 if(['arrive','deliver','fail'].includes(command)&&u.role==='Driver'&&b?.driverId===u.id){
  if(command==='arrive'&&b.status==='Filled')return {title:'Record arrival',body:form('instant',message(`Confirm arrival at ${b.address}.`),'Mark arrived',{type:'trip.arrive',bookingId:b.id})};
  if(command==='deliver'&&b.status==='Arrived')return {title:'Record completed delivery',body:form('instant',message(`Confirm the water was delivered to ${b.address}. The customer must confirm receipt.`),'Mark delivered',{type:'trip.deliver',bookingId:b.id})};
  if(command==='fail'&&['Filled','Arrived'].includes(b.status))return {title:'Report unsuccessful trip',body:form('fail',message(`${b.id} • Choose why the delivery could not finish.`)+choice('Failure reason','reason',s.config.failureReasons.map(x=>({id:x,name:x})),'','required')+field('Additional note (optional)','extra',textArea('extra','', 'maxlength="240"')),'Mark failed',{bookingId:b.id})};
 }
 if(u.role==='Administrator')return adminModal(s,command,id);
 return null;
}
function adminModal(s,command,id){
 const [,operation,kind]=/^(add|edit|delete)-(zone|hydrant|tanker|rate|user)$/.exec(command)||[];
 if(!operation)return null;
 let existing;
 const collections={zone:'zones',hydrant:'hydrants',tanker:'tankers',rate:'rates',user:'users'};
 existing=s[collections[kind]].find(v=>kind==='rate'?String(v.size)===String(id):v.id===id);
 if(operation==='edit'&&!existing)return null;
 if(operation==='delete')return {title:`Delete ${kind}`,body:form('adminDelete',message(`Delete ${existing?.name||existing?.plate||id}? This will be blocked if other records depend on it.`),'Delete record',{kind,id})};
 const d=existing||{};let fields='';
 if(kind==='zone')fields=field('Zone name','name',input('name','text',d.name,'required'))+field('Description','description',input('description','text',d.description,'maxlength="160"'));
 if(kind==='hydrant')fields=field('Hydrant name','name',input('name','text',d.name,'required'))+field('Location','location',input('location','text',d.location||'','required'))+
  `<fieldset class="check-field"><legend>Served zones</legend>${s.zones.map(z=>`<label class="check-line"><input type="checkbox" name="zoneIds" value="${e(z.id)}" ${d.zoneIds?.includes(z.id)?'checked':''}> ${e(z.name)}</label>`).join('')}<small data-error="zoneIds" class="field-error"></small></fieldset>`+
  field('Opens at','openTime',input('openTime','time',d.openTime||'06:00','required'))+field('Closes at','closeTime',input('closeTime','time',d.closeTime||'22:00','required'))+
  field('Daily quota (gallons)','quotaDaily',input('quotaDaily','number',d.quotaDaily||12000,'required min="1000" step="1000"'))+
  choice('Availability','status',[{id:'Available',name:'Available'},{id:'Unavailable',name:'Unavailable'}],d.status||'Available');
 if(kind==='tanker')fields=field('Vehicle plate','plate',input('plate','text',d.plate||'','required'))+
 choice('Tanker capacity','size',s.config.sizes.map(n=>({id:n,name:`${n.toLocaleString()} gallons`})),d.size,'required')+
 choice('Home hydrant','hydrantId',s.hydrants,d.hydrantId||'', 'required')+
 choice('Availability','status',[{id:'Available',name:'Available'},{id:'Unavailable',name:'Unavailable'}],d.status||'Available');
 if(kind==='rate')fields=`<p class="notice">Capacity: ${Number(d.size).toLocaleString()} gallons</p>`+field('Commercial rate (PKR)','commercial',input('commercial','number',d.commercial,'required min="1"'))+field('Subsidised rate (PKR)','subsidised',input('subsidised','number',d.subsidised,'required min="1"'));
 if(kind==='user')fields=field('Full name','name',input('name','text',d.name,'required'))+field('Email','email',input('email','email',d.email,'required'))+
 choice('Role','role',s.config.roles.map(r=>({id:r,name:r})),d.role,'required')+
 choice('Customer category','customerType',s.config.customerCategories.map(x=>({id:x,name:x})),d.customerType||'Household')+
 field('Phone','phone',input('phone','tel',d.phone||'','placeholder="03XXXXXXXXX"'))+
 choice('Zone (for customer / zone officer)','zoneId',s.zones,d.zoneId||'')+
 choice('Hydrant (for operator / driver)','hydrantId',s.hydrants,d.hydrantId||'')+
 field('Address (customer)','address',input('address','text',d.address||''))+
 field('CNIC (customer)','cnic',input('cnic','text',d.cnic||'','inputmode="numeric" maxlength="13"'))+
 field('Password (demo only)','password',input('password','password','','placeholder="Leave blank to keep existing"'))+
 field('Subsidy monthly limit','monthlyLimit',input('monthlyLimit','number',d.monthlyLimit||2,'min="1" max="12"'))+
 choice('Account status','status',[{id:'Active',name:'Active'},{id:'Inactive',name:'Inactive'}],d.status||'Active');
 return {title:`${operation==='add'?'Add':'Edit'} ${kind}`,body:form('adminUpsert',`<div class="form-grid">${fields}</div>`,operation==='add'?'Create record':'Save changes',{kind,id:id||''})};
}
