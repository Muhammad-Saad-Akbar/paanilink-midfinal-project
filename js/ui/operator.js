import {e,badge,heading,summaryStrip,panel,btn,bookingTable,table,tr,nameOf} from './common.js';
import {quotaUsed} from '../utils/rules.js';
import {localISO} from '../utils/time.js';
export const tabs=[{id:'overview',label:'Overview',glyph:'◫'},{id:'queue',label:'Dispatch queue',glyph:'▤'},{id:'fleet',label:'Fleet & hydrant',glyph:'▦'}];
export const dispatchActions=b=>b.status==='Approved'?btn('Assign','assign',b.id,'primary sm'):b.status==='Assigned'?btn('Filled & departed','fill',b.id,'primary sm'):'';
function fleet(s,u){
 const hydrant=s.hydrants.find(h=>h.id===u.hydrantId);const tankers=s.tankers.filter(t=>t.hydrantId===u.hydrantId);
 return `${panel('Hydrant settings',hydrant?`<div class="hydrant-info"><div><h3>${e(hydrant.name)}</h3><p>${e(hydrant.location)} · ${e(hydrant.openTime)}–${e(hydrant.closeTime)}</p><p>Daily quota <strong>${hydrant.quotaDaily.toLocaleString()} gallons</strong></p></div><div>${badge(hydrant.status)} ${btn(hydrant.status==='Available'?'Set unavailable':'Restore hydrant','toggle-hydrant',hydrant.id,'secondary')}</div></div>`:'No assigned hydrant.')}
 ${panel('Registered tankers',table(['Registration','Capacity','Status','Action'],tankers.map(t=>tr([e(t.plate),`${t.size.toLocaleString()} gal`,badge(t.status),btn(t.status==='Available'?'Mark unavailable':'Set available','toggle-tanker',t.id,'secondary sm')]))))}`;
}
export function view(s,u,tab){
 const b=s.bookings.filter(b=>b.hydrantId===u.hydrantId).sort((a,b)=>b.date.localeCompare(a.date));
 const ready=b.filter(b=>b.status==='Approved');const dispatching=b.filter(b=>['Assigned','Filled','Arrived'].includes(b.status));
 const hydrant=s.hydrants.find(h=>h.id===u.hydrantId),today=localISO();
 if(tab==='fleet')return `${heading('ASSETS','Hydrant & fleet','Availability affects new bookings and assignments.')}${fleet(s,u)}`;
 if(tab==='queue')return `${heading('OPERATIONS','Dispatch queue','Assign matching resources, then record tanker fill and departure.')}${panel('All hydrant bookings',bookingTable(s,b,{includeCustomer:true,actions:dispatchActions}))}`;
 return `${heading('HYDRANT OPERATOR','Dispatch overview',hydrant?.name||'No hydrant assigned')}
 ${summaryStrip([['Ready to assign',String(ready.length),'Approved bookings'],['In transit workflow',String(dispatching.length),'Assigned / filled / arrived'],['Quota reserved today',`${quotaUsed(s,u.hydrantId,today).toLocaleString()} gal`,'Includes confirmed allocations'],['Hydrant status',hydrant?.status||'Unknown','Availability control']])}
 ${panel('Ready for dispatch',bookingTable(s,ready,{includeCustomer:true,actions:dispatchActions}))}
 ${panel('Active dispatches',bookingTable(s,dispatching,{includeCustomer:true,actions:dispatchActions}))}`;
}
