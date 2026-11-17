// This module simulates server-side transactions for phase 1, but cannot guarantee
// safety across browsers/devices. Real backend MUST recheck and lock all resources.
import {RuleError,checkRegistration,validateBooking,validateProof,requireActor,activeStatus,quotaUsed,eligibleDrivers,eligibleTankers,validCNIC,validPhone} from '../utils/rules.js';
import {nowStamp} from '../utils/time.js';
const fail=(message,status=422,fields={})=>{throw new RuleError(message,status,fields);};
const find=(arr,id,label='Record')=>{const obj=arr.find(x=>x.id===id);if(!obj) fail(`${label} not found.`,404);return obj;};
const code=prefix=>`${prefix}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const log=(b,status,actor,note='')=>{b.status=status;b.history.push({status,at:nowStamp(),by:actor.id,note});};
const belongs=(booking,u)=>u.role==='Administrator' || (u.role==='Customer'&&booking.customerId===u.id) || (u.role==='Zone Officer'&&booking.zoneId===u.zoneId) || (u.role==='Hydrant Operator'&&booking.hydrantId===u.hydrantId) || (u.role==='Driver'&&booking.driverId===u.id);
const customerFrom=(store,id)=>find(store.users,id,'Customer');

export function executeMock(state,action,payload={},actor=null) {
  const store=structuredClone(state);
  if(action==='customer.register') {
    checkRegistration(store,payload);
    const user={id:code('u'),name:payload.name.trim(),email:payload.email.trim().toLowerCase(),password:payload.password,role:'Customer',customerType:payload.customerType,cnic:payload.cnic.trim(),phone:payload.phone.trim(),address:payload.address.trim(),zoneId:payload.zoneId,subsidyStatus:'None',monthlyLimit:store.config.defaultMonthlySubsidyLimit,hydrantId:null,status:'Active'};
    store.users.push(user);return {store,result:{id:user.id,name:user.name,role:user.role}};
  }
  const u=requireActor(store,actor);
  switch(action) {
  case 'booking.create': {
    if(u.role!=='Customer') fail('Customers only.',403);
    const {rate}=validateBooking(store,u,payload);
    const b={id:code('PL'),customerId:u.id,zoneId:u.zoneId,hydrantId:payload.hydrantId,address:payload.address.trim(),type:payload.type,size:Number(payload.size),date:payload.date,slotTime:payload.slotTime,status:'Pending',amount:rate[payload.type],tankerId:null,driverId:null,history:[]};
    log(b,b.type==='commercial'?'Approved':'Pending',u,b.type==='commercial'?'Commercial booking automatically approved':'Awaiting zone officer approval');
    store.bookings.unshift(b);return {store,result:{id:b.id,status:b.status}};
  }
  case 'booking.cancel': {
    if(u.role!=='Customer') fail('Customers only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking'); if(b.customerId!==u.id) fail('Not your booking.',403);
    activeStatus(b,['Pending','Approved','Assigned']);log(b,'Cancelled',u,'Cancelled by customer before filling');return {store,result:b};
  }
  case 'booking.confirm': {
    if(u.role!=='Customer') fail('Customers only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.customerId!==u.id) fail('Not your booking.',403);
    activeStatus(b,['Delivered']);log(b,'Confirmed',u,'Customer confirmed delivery');return {store,result:b};
  }
  case 'booking.dispute': {
    if(u.role!=='Customer') fail('Customers only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.customerId!==u.id) fail('Not your booking.',403);
    activeStatus(b,['Delivered']);if(!String(payload.reason||'').trim()) fail('Provide a dispute reason.',422,{reason:'Explain the problem.'});
    const d={id:code('dis'),bookingId:b.id,customerId:u.id,reason:payload.reason.trim(),status:'Open',resolution:'',createdAt:nowStamp(),resolvedBy:null};
    store.disputes.unshift(d);log(b,'Disputed',u,payload.reason.trim());return {store,result:d};
  }
  case 'subsidy.apply': {
    if(u.role!=='Customer') fail('Customers only.',403);
    if (u.subsidyStatus==='Approved'||u.subsidyStatus==='Pending') fail('An approved or pending application already exists.',409);
    validateProof(payload);
    const app={id:code('app'),customerId:u.id,proofType:payload.proofType,proofReference:payload.proofReference.trim(),proofName:payload.proofName||'',proofDataUrl:payload.proofDataUrl||'',status:'Pending',submittedAt:nowStamp(),reviewedBy:null,reviewNote:''};
    store.applications.unshift(app);u.subsidyStatus='Pending';return {store,result:app};
  }
  case 'subsidy.review': {
    if(u.role!=='Zone Officer') fail('Zone officer only.',403);
    const a=find(store.applications,payload.applicationId,'Application'); const customer=customerFrom(store,a.customerId);
    if(customer.zoneId!==u.zoneId) fail('Application outside your zone.',403);
    if(a.status!=='Pending') fail('Application already reviewed.',409);
    if(!['Approved','Rejected'].includes(payload.decision)) fail('Choose approve or reject.');
    a.status=payload.decision;a.reviewedBy=u.id;a.reviewNote=String(payload.note||'').trim();a.reviewedAt=nowStamp();customer.subsidyStatus=payload.decision;
    return {store,result:a};
  }
  case 'booking.review': {
    if(u.role!=='Zone Officer') fail('Zone officer only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.zoneId!==u.zoneId) fail('Booking outside your zone.',403);
    if(b.type!=='subsidised') fail('Commercial bookings do not need review.',409);
    activeStatus(b,['Pending']);if(!['Approved','Rejected'].includes(payload.decision)) fail('Choose approve or reject.');
    if(payload.decision==='Approved') validateBooking(store,customerFrom(store,b.customerId),b,{approving:true,excludingId:b.id});
    log(b,payload.decision,u,payload.note||`${payload.decision} by zone officer`);return {store,result:b};
  }
  case 'dispute.resolve': {
    if(u.role!=='Zone Officer') fail('Zone officer only.',403);
    const d=find(store.disputes,payload.disputeId,'Dispute');const b=find(store.bookings,d.bookingId,'Booking');
    if(b.zoneId!==u.zoneId) fail('Dispute outside your zone.',403);
    if(d.status!=='Open') fail('Dispute already resolved.',409);
    if(!String(payload.resolution||'').trim()) fail('Resolution is required.',422,{resolution:'Describe the resolution.'});
    d.status='Resolved';d.resolution=payload.resolution.trim();d.resolvedBy=u.id;d.resolvedAt=nowStamp();
    b.history.push({status:'Dispute resolved',at:nowStamp(),by:u.id,note:d.resolution});return {store,result:d};
  }
  case 'dispatch.assign': {
    if(u.role!=='Hydrant Operator') fail('Hydrant operator only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.hydrantId!==u.hydrantId) fail('Wrong hydrant.',403);
    activeStatus(b,['Approved']);
    const hydrant=find(store.hydrants,b.hydrantId,'Hydrant');if(hydrant.status!=='Available') fail('Hydrant is unavailable.',409);
    if(quotaUsed(store,hydrant.id,b.date,b.id)+Number(b.size)>hydrant.quotaDaily) fail('Hydrant quota exceeded.',409);
    const tanker=eligibleTankers(store,b).find(t=>t.id===payload.tankerId);
    const driver=eligibleDrivers(store,b).find(d=>d.id===payload.driverId);
    if(!tanker) fail('Tanker unavailable, wrong size or double-booked.',409,{tankerId:'Select an available matching tanker.'});
    if(!driver) fail('Driver unavailable or already booked at this time.',409,{driverId:'Select an available driver.'});
    b.tankerId=tanker.id;b.driverId=driver.id;log(b,'Assigned',u,`${tanker.plate} / ${driver.name}`);return {store,result:b};
  }
  case 'dispatch.fill': {
    if(u.role!=='Hydrant Operator') fail('Hydrant operator only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.hydrantId!==u.hydrantId) fail('Wrong hydrant.',403);
    activeStatus(b,['Assigned']);if(find(store.hydrants,b.hydrantId,'Hydrant').status!=='Available') fail('Hydrant unavailable.',409);
    if(find(store.tankers,b.tankerId,'Tanker').status!=='Available') fail('Tanker unavailable.',409);
    log(b,'Filled',u,'Filled at hydrant; tanker departed');return {store,result:b};
  }
  case 'dispatch.tankerAvailability': {
    if(u.role!=='Hydrant Operator') fail('Hydrant operator only.',403);
    const t=find(store.tankers,payload.tankerId,'Tanker');if(t.hydrantId!==u.hydrantId) fail('Wrong hydrant.',403);
    if(!['Available','Unavailable'].includes(payload.status)) fail('Invalid availability.');
    if(payload.status==='Unavailable' && store.bookings.some(b=>b.tankerId===t.id && ['Assigned','Filled','Arrived'].includes(b.status))) fail('Cannot disable tanker with active trips.',409);
    t.status=payload.status;return {store,result:t};
  }
  case 'dispatch.hydrantAvailability': {
    if(u.role!=='Hydrant Operator') fail('Hydrant operator only.',403);
    const h=find(store.hydrants,u.hydrantId,'Hydrant');if(!['Available','Unavailable'].includes(payload.status)) fail('Invalid status.');
    h.status=payload.status;return {store,result:h};
  }
  case 'trip.arrive': case 'trip.deliver': case 'trip.fail': {
    if(u.role!=='Driver') fail('Driver only.',403);
    const b=find(store.bookings,payload.bookingId,'Booking');if(b.driverId!==u.id) fail('Not your trip.',403);
    if(action==='trip.arrive') {activeStatus(b,['Filled']);log(b,'Arrived',u,'Driver reached delivery location');}
    if(action==='trip.deliver') {activeStatus(b,['Arrived']);log(b,'Delivered',u,'Water delivered; awaiting customer confirmation');}
    if(action==='trip.fail') {
      activeStatus(b,['Filled','Arrived']);if(!String(payload.reason||'').trim()) fail('Failure reason is required.',422,{reason:'Choose or enter a reason.'});
      b.failureReason=payload.reason.trim();log(b,'Failed',u,b.failureReason);
    }
    return {store,result:b};
  }
  case 'admin.upsert': {
    if(u.role!=='Administrator') fail('Administrator only.',403);
    const kind=payload.kind; const collections={zone:'zones',hydrant:'hydrants',tanker:'tankers',rate:'rates',user:'users'};
    if(!collections[kind]) fail('Unsupported entity.',404);
    const arr=store[collections[kind]];const data=payload.data||{};
    const existing=arr.find(item=>kind==='rate'?Number(item.size)===Number(data.size):item.id===data.id);
    let obj;
    if(kind==='zone') {
      if(!String(data.name||'').trim()) fail('Zone name is required.',422,{name:'Required field.'});
      obj={id:existing?.id||code('z'),name:data.name.trim(),description:String(data.description||'').trim()};
    } else if(kind==='hydrant') {
      if(!String(data.name||'').trim()||!Array.isArray(data.zoneIds)||!data.zoneIds.length || !data.zoneIds.every(id=>store.zones.some(z=>z.id===id))) fail('Hydrant needs a name and valid zones.');
      const q=Number(data.quotaDaily);if(!Number.isInteger(q)||q<1000) fail('Quota must be at least 1,000 gallons.',422,{quotaDaily:'At least 1,000.'});
      if(!/^\d{2}:\d{2}$/.test(data.openTime||'')||!/^\d{2}:\d{2}$/.test(data.closeTime||'') || data.openTime>=data.closeTime) fail('Hydrant opening and closing hours are invalid.');
      obj={id:existing?.id||code('h'),name:data.name.trim(),location:String(data.location||'').trim(),zoneIds:data.zoneIds,openTime:data.openTime,closeTime:data.closeTime,quotaDaily:q,status:data.status||'Available'};
      if(existing) {
        const scheduled=store.bookings.filter(b=>b.hydrantId===existing.id && !['Pending','Cancelled','Rejected'].includes(b.status));
        const dates=new Set(scheduled.map(b=>b.date));
        if([...dates].some(date=>quotaUsed(store,existing.id,date)>q)) fail('New quota is below reserved water for an existing date.',409);
        const m=t=>{const [h,mi]=t.split(':').map(Number);return h*60+mi;};
        if(scheduled.some(b=>m(b.slotTime)<m(data.openTime)||m(b.slotTime)+store.config.slotMinutes>m(data.closeTime))) fail('Cannot change opening hours while existing bookings fall outside them.',409);
        if(scheduled.some(b=>!data.zoneIds.includes(b.zoneId))) fail('Cannot remove a zone that already has bookings at this hydrant.',409);
      }
    } else if(kind==='tanker') {
      if(!String(data.plate||'').trim()||!store.config.sizes.includes(Number(data.size))||!store.hydrants.some(h=>h.id===data.hydrantId)) fail('Valid plate, size and hydrant are required.');
      if(store.tankers.some(t=>t.plate.toLowerCase()===data.plate.trim().toLowerCase()&&t.id!==existing?.id)) fail('Plate already exists.',409);
      if(existing&&store.bookings.some(b=>b.tankerId===existing.id&&['Assigned','Filled','Arrived'].includes(b.status))&&(existing.hydrantId!==data.hydrantId||existing.size!==Number(data.size)||data.status==='Unavailable')) fail('Cannot reassign or disable a tanker while it has active trips.',409);
      obj={id:existing?.id||code('t'),plate:data.plate.trim().toUpperCase(),size:Number(data.size),hydrantId:data.hydrantId,status:data.status||'Available'};
    } else if(kind==='rate') {
      if(!store.config.sizes.includes(Number(data.size))||!(Number(data.commercial)>0)||!(Number(data.subsidised)>0)||Number(data.subsidised)>=Number(data.commercial)) fail('Enter valid size and rates (subsidised must be lower).');
      obj={size:Number(data.size),commercial:Number(data.commercial),subsidised:Number(data.subsidised)};
    } else {
      if(!String(data.name||'').trim()||!String(data.email||'').trim()||!store.config.roles.includes(data.role)) fail('Name, email and role are required.');
      if(store.users.some(x=>x.id!==existing?.id && x.email.toLowerCase()===data.email.trim().toLowerCase())) fail('This email already exists.',409);
      if(data.zoneId && !store.zones.some(z=>z.id===data.zoneId)) fail('Invalid zone.');
      if(data.hydrantId && !store.hydrants.some(h=>h.id===data.hydrantId)) fail('Invalid hydrant.');
      if(data.role==='Customer') {
        const cnic=data.cnic||existing?.cnic,phone=data.phone||existing?.phone,address=data.address||existing?.address;
        if(!validCNIC(cnic)) fail('Customer needs a valid 13-digit CNIC.',422,{cnic:'Exactly 13 digits.'});
        if(!validPhone(phone)) fail('Customer needs a Pakistani phone number.',422,{phone:'Use 03XXXXXXXXX.'});
        if(!String(address||'').trim()||!data.zoneId) fail('Customer needs a delivery address and zone.',422,{address:'Address and service zone required.'});
        if(store.users.some(other=>other.id!==existing?.id&&other.cnic===cnic)) fail('CNIC already registered.',409,{cnic:'CNIC already exists.'});
      }
      if(data.role==='Zone Officer'&&!data.zoneId) fail('Zone officer must be assigned a zone.');
      if(['Driver','Hydrant Operator'].includes(data.role)&&!data.hydrantId) fail('Driver / operator must be assigned a hydrant.');
      if(existing && existing.id===u.id && (data.role!==u.role || data.status==='Inactive')) fail('Cannot remove your own administrator access.',409);
      if(existing&&store.bookings.some(b=>['Assigned','Filled','Arrived'].includes(b.status)&&b.driverId===existing.id)&& (data.role!=='Driver'||data.hydrantId!==existing.hydrantId||data.status==='Inactive')) fail('Cannot alter a driver assigned to active trips.',409);
      obj={...existing,id:existing?.id||code('u'),name:data.name.trim(),email:data.email.trim().toLowerCase(),role:data.role,customerType:data.customerType||existing?.customerType||'Household',phone:data.phone||existing?.phone||'',cnic:data.cnic||existing?.cnic||'',address:data.address||existing?.address||'',zoneId:data.zoneId||null,hydrantId:data.hydrantId||null,status:data.status||'Active',password:data.password||existing?.password||'demo123',subsidyStatus:existing?.subsidyStatus||'None',monthlyLimit:Number(data.monthlyLimit||existing?.monthlyLimit||store.config.defaultMonthlySubsidyLimit)};
    }
    if(existing) Object.assign(existing,obj);else arr.push(obj);
    return {store,result:obj};
  }
  case 'admin.delete': {
    if(u.role!=='Administrator') fail('Administrator only.',403);
    const collections={zone:'zones',hydrant:'hydrants',tanker:'tankers',user:'users'};const kind=payload.kind;
    if(!collections[kind]) fail('Cannot delete this resource.',422);
    const arr=store[collections[kind]], i=arr.findIndex(x=>x.id===payload.id);if(i<0) fail('Record not found.',404);
    if(kind==='user' && payload.id===u.id) fail('You cannot delete your own account.',409);
    const references={zone:store.users.some(x=>x.zoneId===payload.id)||store.hydrants.some(h=>h.zoneIds.includes(payload.id))||store.bookings.some(b=>b.zoneId===payload.id),hydrant:store.users.some(x=>x.hydrantId===payload.id)||store.tankers.some(t=>t.hydrantId===payload.id)||store.bookings.some(b=>b.hydrantId===payload.id),tanker:store.bookings.some(b=>b.tankerId===payload.id),user:store.bookings.some(b=>b.customerId===payload.id||b.driverId===payload.id)||store.applications.some(a=>a.customerId===payload.id)};
    if(references[kind]) fail('This record is referenced elsewhere. Edit it rather than deleting it.',409);
    arr.splice(i,1);return {store,result:{deleted:payload.id}};
  }
  default: fail('Action endpoint not found.',404);
  }
}
