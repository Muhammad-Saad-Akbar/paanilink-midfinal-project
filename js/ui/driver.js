import {e,badge,heading,summaryStrip,panel,btn,empty,nameOf} from './common.js';
import {dateLabel} from '../utils/time.js';
export const tabs=[{id:'overview',label:'My dashboard',glyph:'◫'},{id:'trips',label:'All my trips',glyph:'▤'}];
const tripActions=b=>b.status==='Filled'?`${btn('I have arrived','arrive',b.id,'primary tap')}${btn('Report failure','fail',b.id,'secondary tap')}`:b.status==='Arrived'?`${btn('Mark delivered','deliver',b.id,'primary tap')}${btn('Report failure','fail',b.id,'secondary tap')}`:'';
function tripCard(s,b){return `<article class="trip-card"><div class="trip-top"><span class="trip-number">${e(b.id)}</span>${badge(b.status)}</div>
 <h3>${e(b.address)}</h3><p class="trip-date">${e(dateLabel(b.date))} · ${e(b.slotTime)} | ${b.size.toLocaleString()} gallons</p>
 <dl><div><dt>Pickup</dt><dd>${e(nameOf(s,'hydrants',b.hydrantId))}</dd></div><div><dt>Tanker</dt><dd>${e(nameOf(s,'tankers',b.tankerId,'plate'))}</dd></div></dl>
 <div class="trip-actions">${tripActions(b)}${btn('Trip details','detail',b.id,'ghost tap')}</div></article>`;}
export function view(s,u,tab){
 const trips=s.bookings.filter(b=>b.driverId===u.id).sort((a,b)=>b.date.localeCompare(a.date));
 const active=trips.filter(b=>['Assigned','Filled','Arrived'].includes(b.status));
 const done=trips.filter(b=>['Delivered','Confirmed','Disputed'].includes(b.status));
 const list=tab==='overview'?active:trips;
 return `${heading('DRIVER WORKSPACE',tab==='overview'?'Your next trips':'My trip history',`Signed in as ${u.name}. Only your assigned trips are shown.`)}
 ${summaryStrip([['Assigned to me',String(trips.length),'Visible trips only'],['Active',String(active.length),'Trips requiring attention'],['Delivered',String(done.length),'Completed water drops']])}
 ${panel(tab==='overview'?'Active trip cards':'All assigned trips',`<div class="trip-grid">${list.length?list.map(b=>tripCard(s,b)).join(''):empty('No assigned trips','Your hydrant operator will assign one when available.')}</div>`,'Use the large controls after reaching the customer.')}`;
}
