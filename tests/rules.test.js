import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {executeMock} from '../js/api/mock-engine.js';
import {validCNIC,validPhone,validateBooking,eligibleTankers,eligibleDrivers,quotaUsed,subsidyMonthUsed} from '../js/utils/rules.js';
import {offsetDate} from '../js/utils/time.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../mock-api');
const keys=['config','zones','hydrants','tankers','rates','users','bookings','applications','disputes'];
function fresh(){const s=Object.fromEntries(keys.map(k=>[k,JSON.parse(readFileSync(resolve(root,`${k}.json`),'utf8'))]));s.bookings.forEach(b=>{if('offsetDays' in b){b.date=offsetDate(b.offsetDays);delete b.offsetDays;}});return s;}
const actor=userId=>({userId});
const booked=(overrides={})=>({hydrantId:'h1',date:offsetDate(5),slotTime:'09:00',size:1000,type:'commercial',address:'Demo address 101',...overrides});
const act=(s,type,payload={},id='u1')=>executeMock(s,type,payload,actor(id));

test('CNIC has 13 digits; Pakistani phone supports three common prefixes',()=>{
 assert.equal(validCNIC('4210112345671'),true);assert.equal(validCNIC('42101-1234567-1'),false);
 for(const v of ['03001234567','+923001234567','923001234567'])assert.equal(validPhone(v),true);
 assert.equal(validPhone('1234567890'),false);
});
test('commercial booking auto-approved and reserves quota',()=>{
 const s=fresh(),result=act(s,'booking.create',booked());assert.equal(result.result.status,'Approved');
 assert.equal(quotaUsed(result.store,'h1',offsetDate(5)),1000);
});
test('subsidised booking starts Pending; officer can approve it',()=>{
 const {store,result}=act(fresh(),'booking.create',booked({type:'subsidised'}));
 assert.equal(result.status,'Pending');const approved=act(store,'booking.review',{bookingId:result.id,decision:'Approved'},'u3');
 assert.equal(approved.result.status,'Approved');assert.equal(approved.result.history.length,2);
});
test('unapproved subsidy cannot be booked',()=>{
 assert.throws(()=>act(fresh(),'booking.create',booked({type:'subsidised'}),'u2'), err=>/subsidy/i.test(err.fields?.type||''));
});
test('monthly subsidy limit blocks third booking, even if first still pending',()=>{
 const s=fresh(),first=act(s,'booking.create',booked({type:'subsidised',date:offsetDate(2)})).store;
 assert.equal(subsidyMonthUsed(first,'u1',offsetDate(2)),2); // seeded Pending + new Pending
 assert.throws(()=>act(first,'booking.create',booked({type:'subsidised',date:offsetDate(3)})),err=>/monthly/i.test(err.fields?.type||''));
});
test('wrong zone and outside hydrant hours are rejected',()=>{
 assert.throws(()=>act(fresh(),'booking.create',booked({hydrantId:'h3'})),err=>/zone/i.test(err.fields?.hydrantId||''));
 assert.throws(()=>act(fresh(),'booking.create',booked({slotTime:'23:30'})),/booking fields/i);
});
test('quota is rejected if oversubscribed',()=>{
 const s=fresh();s.hydrants.find(x=>x.id==='h1').quotaDaily=2000;
 assert.throws(()=>act(s,'booking.create',booked({size:3000})),/booking fields/i);
});
test('officer from another zone cannot approve another zone request',()=>{
 const {store,result}=act(fresh(),'booking.create',booked({type:'subsidised'}));
 assert.throws(()=>act(store,'booking.review',{bookingId:result.id,decision:'Approved'},'u7'),/outside your zone/i);
});
test('zone officer cannot dispatch and driver cannot confirm',()=>{
 assert.throws(()=>act(fresh(),'dispatch.assign',{bookingId:'PL-1002',tankerId:'t2',driverId:'u5'},'u3'),/operator only/i);
 assert.throws(()=>act(fresh(),'booking.confirm',{bookingId:'PL-1005'},'u5'),/customers only/i);
});
test('same 90-minute window blocks tanker/driver reuse',()=>{
 const a=act(fresh(),'booking.create',booked({size:3000,date:offsetDate(6),slotTime:'09:00'}));
 const one=act(a.store,'dispatch.assign',{bookingId:a.result.id,tankerId:'t2',driverId:'u5'},'u4');
 const c=act(one.store,'booking.create',booked({size:3000,date:offsetDate(6),slotTime:'09:30'}));
 assert.equal(eligibleTankers(c.store,c.store.bookings.find(x=>x.id===c.result.id)).some(t=>t.id==='t2'),false);
 assert.equal(eligibleDrivers(c.store,c.store.bookings.find(x=>x.id===c.result.id)).some(d=>d.id==='u5'),false);
 assert.throws(()=>act(c.store,'dispatch.assign',{bookingId:c.result.id,tankerId:'t2',driverId:'u5'},'u4'),/tanker unavailable/i);
});
test('workflow: assign -> fill -> arrive -> deliver -> confirm',()=>{
 let s=fresh();const b=act(s,'booking.create',booked({size:3000,date:offsetDate(7),slotTime:'10:00'}));s=b.store;
 s=act(s,'dispatch.assign',{bookingId:b.result.id,tankerId:'t2',driverId:'u5'},'u4').store;
 s=act(s,'dispatch.fill',{bookingId:b.result.id},'u4').store;
 s=act(s,'trip.arrive',{bookingId:b.result.id},'u5').store;
 s=act(s,'trip.deliver',{bookingId:b.result.id},'u5').store;
 const confirmed=act(s,'booking.confirm',{bookingId:b.result.id});assert.equal(confirmed.result.status,'Confirmed');
 assert.deepEqual(confirmed.result.history.map(x=>x.status),['Approved','Assigned','Filled','Arrived','Delivered','Confirmed']);
});
test('customer can dispute delivered water; correct officer resolves in zone',()=>{
 const s=fresh();const {store,result}=act(s,'booking.dispute',{bookingId:'PL-1005',reason:'Only half the requested water arrived.'},'u2');
 assert.equal(store.bookings.find(x=>x.id==='PL-1005').status,'Disputed');
 assert.throws(()=>act(store,'dispute.resolve',{disputeId:result.id,resolution:'Check done'},'u3'),/outside your zone/i);
 assert.equal(act(store,'dispute.resolve',{disputeId:result.id,resolution:'Refund under review'},'u7').result.status,'Resolved');
});
test('customer cannot cancel after filling; failed driver requires a reason',()=>{
 assert.throws(()=>act(fresh(),'booking.cancel',{bookingId:'PL-1004'}),/unavailable/i);
 assert.throws(()=>act(fresh(),'trip.fail',{bookingId:'PL-1004',reason:''},'u8'),/reason is required/i);
});
test('subsidy application review limited to assigned zone',()=>{
 const s=fresh();assert.throws(()=>act(s,'subsidy.review',{applicationId:'app-002',decision:'Approved'},'u3'),/outside your zone/i);
 const {store}=act(s,'subsidy.review',{applicationId:'app-002',decision:'Approved'},'u7');
 assert.equal(store.users.find(u=>u.id==='u2').subsidyStatus,'Approved');
});
test('administrator can create a zone, but cannot delete a referenced hydrant',()=>{
 const {store,result}=act(fresh(),'admin.upsert',{kind:'zone',data:{name:'Central Zone',description:'Demo area'}},'u6');assert.equal(result.name,'Central Zone');
 assert.throws(()=>act(store,'admin.delete',{kind:'hydrant',id:'h1'},'u6'),/referenced elsewhere/i);
});
test('customer signup validates details and saves account category',()=>{
 const payload={name:'Demo Hospital',email:'hospital@demo.test',password:'demo123',cnic:'4210112345679',phone:'03009998877',zoneId:'z3',address:'Street 9 Clifton',customerType:'Hospital'};
 const {store,result}=executeMock(fresh(),'customer.register',payload,null);
 assert.equal(result.role,'Customer');assert.equal(store.users.find(x=>x.id===result.id).customerType,'Hospital');
 assert.throws(()=>executeMock(store,'customer.register',{...payload,email:'different@demo.test'},null),err=>Boolean(err.fields?.cnic));
});
test('cancelling an unfilled commercial booking releases reserved water',()=>{
 const created=act(fresh(),'booking.create',booked({date:offsetDate(10)}));
 assert.equal(quotaUsed(created.store,'h1',offsetDate(10)),1000);
 const cancelled=act(created.store,'booking.cancel',{bookingId:created.result.id});
 assert.equal(cancelled.result.status,'Cancelled');assert.equal(quotaUsed(cancelled.store,'h1',offsetDate(10)),0);
});
test('an unavailable hydrant blocks booking and operator can restore it',()=>{
 let s=act(fresh(),'dispatch.hydrantAvailability',{status:'Unavailable'},'u4').store;
 assert.throws(()=>act(s,'booking.create',booked({date:offsetDate(11)})),err=>Boolean(err.fields?.hydrantId));
 s=act(s,'dispatch.hydrantAvailability',{status:'Available'},'u4').store;
 assert.equal(act(s,'booking.create',booked({date:offsetDate(11)})).result.status,'Approved');
});
test('operator cannot disable vehicle with active assigned trip',()=>{
 assert.throws(()=>act(fresh(),'dispatch.tankerAvailability',{tankerId:'t3',status:'Unavailable'},'u4'),/active trips/i);
});
test('admin cannot reduce a quota below reservations for the same day',()=>{
 const s=fresh();const hyd=s.hydrants.find(h=>h.id==='h1');
 assert.throws(()=>act(s,'admin.upsert',{kind:'hydrant',data:{...hyd,quotaDaily:1000}},'u6'),/below reserved water/i);
});
