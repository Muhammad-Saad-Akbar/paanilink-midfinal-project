import {e,badge,heading,summaryStrip,panel,btn,bookingTable,table,tr,nameOf} from './common.js';
import {dateLabel} from '../utils/time.js';
export const tabs=[{id:'overview',label:'Overview',glyph:'◫'},{id:'bookings',label:'Zone bookings',glyph:'▤'},{id:'applications',label:'Subsidy requests',glyph:'◇'},{id:'disputes',label:'Disputes',glyph:'!'}];
export const reviewActions=b=>b.type==='subsidised'&&b.status==='Pending'?`${btn('Approve','approve-booking',b.id,'primary sm')}${btn('Reject','reject-booking',b.id,'danger sm')}`:'';
const applicationTable=(s,apps)=>table(['Applicant','Submitted','Proof','Reference','Status','Actions'],apps.map(a=>tr([e(nameOf(s,'users',a.customerId)),e(dateLabel(a.submittedAt?.slice(0,10))),e(a.proofType),e(a.proofReference),badge(a.status),a.status==='Pending'?`${btn('Approve','approve-app',a.id,'primary sm')}${btn('Reject','reject-app',a.id,'danger sm')}`:'Reviewed'])),'No subsidy requests in this zone.');
const disputeTable=(s,disputes)=>table(['Booking','Customer','Issue','State','Actions'],disputes.map(d=>tr([e(d.bookingId),e(nameOf(s,'users',d.customerId)),e(d.reason),badge(d.status),d.status==='Open'?btn('Resolve','resolve-dispute',d.id,'primary sm'):`<small>${e(d.resolution)}</small>`])),'No disputes for your zone.');
export function view(s,u,tab){
 const b=s.bookings.filter(x=>x.zoneId===u.zoneId).sort((a,b)=>b.date.localeCompare(a.date));
 const apps=s.applications.filter(a=>s.users.some(c=>c.id===a.customerId&&c.zoneId===u.zoneId));
 const disputes=s.disputes.filter(d=>b.some(x=>x.id===d.bookingId));
 const pending=b.filter(x=>x.type==='subsidised'&&x.status==='Pending');
 const pendingApps=apps.filter(x=>x.status==='Pending');const openDisputes=disputes.filter(d=>d.status==='Open');
 if(tab==='bookings')return `${heading('ZONE CONTROL', 'Zone bookings',`Bookings assigned to ${s.zones.find(z=>z.id===u.zoneId)?.name||'your zone'}.`)}${panel('Booking queue',bookingTable(s,b,{includeCustomer:true,actions:reviewActions}))}`;
 if(tab==='applications')return `${heading('ELIGIBILITY', 'Subsidy verification','Review household supporting details before granting subsidised status.')}${panel('Applications',applicationTable(s,apps))}`;
 if(tab==='disputes')return `${heading('SERVICE QUALITY','Delivery disputes','Investigate complaints in your own zone.')}${panel('Dispute cases',disputeTable(s,disputes))}`;
 return `${heading('ZONE OFFICER', `Zone overview`, `Area: ${s.zones.find(z=>z.id===u.zoneId)?.name||'Unassigned'}`)}
 ${summaryStrip([['Zone bookings',String(b.length),'All statuses'],['Awaiting approval',String(pending.length),'Subsidised tanker requests'],['Subsidy applications',String(pendingApps.length),'Need document verification'],['Open disputes',String(openDisputes.length),'Need resolution']])}
 ${panel('Bookings requiring approval',bookingTable(s,pending,{includeCustomer:true,actions:reviewActions}))}
 ${panel('Households awaiting verification',applicationTable(s,pendingApps))}`;
}
