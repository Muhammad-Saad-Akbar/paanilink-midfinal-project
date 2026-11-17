import {e,badge,heading,summaryStrip,panel,btn,table,tr,nameOf,bookingTable} from './common.js';
import {cash,localISO} from '../utils/time.js';
import {quotaUsed} from '../utils/rules.js';
export const tabs=[{id:'overview',label:'City overview',glyph:'◫'},{id:'zones',label:'Zones',glyph:'◎'},{id:'hydrants',label:'Hydrants & quotas',glyph:'◈'},{id:'fleet',label:'Tankers',glyph:'▦'},{id:'rates',label:'Pricing',glyph:'₨'},{id:'users',label:'Users & roles',glyph:'♙'},{id:'reports',label:'Reports',glyph:'▤'}];
function control(kind,id){return `<div class="row-actions">${btn('Edit',`edit-${kind}`,id,'secondary sm')}${btn('Delete',`delete-${kind}`,id,'ghost sm')}</div>`;}
function assetPanel(title,kind,heads,rows){return panel(title,table(heads,rows),'All changes are stored in this browser for the demo.',btn(`+ Add ${kind}`,`add-${kind}`,'','primary sm'));}
function report(s){
 const rows=s.zones.map(z=>{const b=s.bookings.filter(b=>b.zoneId===z.id);const confirmed=b.filter(x=>['Delivered','Confirmed'].includes(x.status));return tr([e(z.name),String(b.length),String(confirmed.length),String(b.filter(x=>x.status==='Pending').length),e(cash(b.reduce((n,x)=>n+(!['Rejected','Cancelled'].includes(x.status)?x.amount:0),0)))]);});
 const hyd=s.hydrants.map(h=>tr([e(h.name),e(h.zoneIds.map(id=>nameOf(s,'zones',id)).join(', ')),`${quotaUsed(s,h.id,localISO()).toLocaleString()} / ${h.quotaDaily.toLocaleString()}`,badge(h.status)]));
 return `${heading('CITY INTELLIGENCE','Operational reports','Summary from the current data snapshot. Real backend will run aggregate SQL queries.')}
 ${panel('Bookings by zone',table(['Zone','Bookings','Delivered','Pending','Booked value'],rows))}
 ${panel('Hydrant quotas, today',table(['Hydrant','Zones served','Reserved / quota (gal)','Status'],hyd))}
 ${panel('All-city booking register',bookingTable(s,s.bookings,{includeCustomer:true}))}`;
}
export function view(s,u,tab){
 if(tab==='zones')return heading('SERVICE AREAS','Zones','Define which neighborhoods each hydrant serves.')+assetPanel('Manage zones','zone',['Zone','Description','Operations'],s.zones.map(z=>tr([`<strong>${e(z.name)}</strong>`,e(z.description),control('zone',z.id)])));
 if(tab==='hydrants')return heading('WATER SOURCES','Hydrants & daily quotas','Operating hours and water allocation are controlled centrally.')+assetPanel('Manage hydrants','hydrant',['Name','Zones served','Hours','Quota','Status','Operations'],s.hydrants.map(h=>tr([e(h.name),e(h.zoneIds.map(id=>nameOf(s,'zones',id)).join(', ')),e(`${h.openTime}–${h.closeTime}`),`${h.quotaDaily.toLocaleString()} gal`,badge(h.status),control('hydrant',h.id)])));
 if(tab==='fleet')return heading('FLEET','Tanker registry','Every tanker has a fixed capacity and home hydrant.')+assetPanel('Manage tankers','tanker',['Plate','Size','Hydrant','Status','Operations'],s.tankers.map(t=>tr([e(t.plate),`${t.size.toLocaleString()} gal`,e(nameOf(s,'hydrants',t.hydrantId)),badge(t.status),control('tanker',t.id)])));
 if(tab==='rates')return heading('PRICE BOOK','Tanker rates','Update prices for future bookings; old invoices retain their booked amount.')+panel('Rates by tanker capacity',table(['Capacity','Commercial','Subsidised','Edit'],s.rates.map(r=>tr([`${r.size.toLocaleString()} gal`,e(cash(r.commercial)),e(cash(r.subsidised)),btn('Edit','edit-rate',String(r.size),'secondary sm')]))));
 if(tab==='users')return heading('ACCESS','User accounts & roles','Assign geographic access for officers, operators and drivers.')+assetPanel('Manage users','user',['Name / email','Role','Assigned area','Account','Operations'],s.users.map(x=>tr([`<strong>${e(x.name)}</strong><br><small>${e(x.email)}</small>`,e(x.role),e(x.zoneId?nameOf(s,'zones',x.zoneId):x.hydrantId?nameOf(s,'hydrants',x.hydrantId):'City-wide'),badge(x.status),control('user',x.id)])));
 if(tab==='reports')return report(s);
 const active=s.bookings.filter(b=>['Approved','Assigned','Filled','Arrived','Pending'].includes(b.status));
 return `${heading('SYSTEM ADMINISTRATION','City operations','A single view across zones, bookings and registered resources.')}
 ${summaryStrip([['Bookings',String(s.bookings.length),'All zones and statuses'],['Active cases',String(active.length),'Waiting / in progress'],['Hydrants',String(s.hydrants.length),'Registered water sources'],['Fleet vehicles',String(s.tankers.length),'Total tanker registry']])}
 ${panel('Recent booking activity',bookingTable(s,s.bookings.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8),{includeCustomer:true}))}
 ${panel('City capacity',table(['Hydrant','Daily quota','Water reserved today','Status'],s.hydrants.map(h=>tr([e(h.name),`${h.quotaDaily.toLocaleString()} gal`,`${quotaUsed(s,h.id,localISO()).toLocaleString()} gal`,badge(h.status)]))))}`;
}
