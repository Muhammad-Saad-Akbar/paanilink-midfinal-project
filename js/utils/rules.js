import { localISO, minutes, overlaps, monthOf } from './time.js';

export class RuleError extends Error {
  constructor(message, status=422, fields={}) { super(message); this.name='RuleError'; this.status=status; this.fields=fields; }
}
export function requireFields(obj, names) {
  const errors={};
  for (const k of names) if (!String(obj[k] ?? '').trim()) errors[k]='This field is required.';
  return errors;
}
export const validCNIC = str => /^\d{13}$/.test(String(str ?? '').trim());
export const validPhone = str => /^(?:03\d{9}|\+923\d{9}|923\d{9})$/.test(String(str ?? '').trim());
export const validEmail = str => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str ?? '').trim());
export const resourceHoldsWater = b => !['Pending','Rejected','Cancelled'].includes(b.status);
export const subsidyCounts = b => b.type==='subsidised' && !['Rejected','Cancelled'].includes(b.status);
export const resourcesReserved = b => Boolean(b.tankerId || b.driverId) && !['Cancelled','Rejected'].includes(b.status);
const invalid = (message,fields={}) => { throw new RuleError(message,422,fields); };

export function checkRegistration(store, data) {
  const fields=requireFields(data,['name','email','password','cnic','phone','address','zoneId','customerType']);
  if (data.cnic && !validCNIC(data.cnic)) fields.cnic='CNIC must contain exactly 13 digits (no dashes).';
  if (data.phone && !validPhone(data.phone)) fields.phone='Use 03XXXXXXXXX, +923XXXXXXXXX or 923XXXXXXXXX.';
  if (data.email && !validEmail(data.email)) fields.email='Enter a valid email address.';
  if (data.password && String(data.password).length<6) fields.password='Password needs at least 6 characters.';
  if (data.zoneId && !store.zones.some(z=>z.id===data.zoneId)) fields.zoneId='Choose a valid zone.';
  if (data.customerType && !store.config.customerCategories.includes(data.customerType)) fields.customerType='Choose a valid category.';
  if (store.users.some(u=>u.email.toLowerCase()===String(data.email||'').trim().toLowerCase())) fields.email='Email already registered.';
  if (store.users.some(u=>u.cnic && u.cnic===data.cnic)) fields.cnic='CNIC already registered.';
  if (Object.keys(fields).length) invalid('Check the highlighted registration fields.',fields);
}
export function quotaUsed(store, hydrantId, date, excludingId=null) {
  return store.bookings.filter(b=>b.id!==excludingId && b.hydrantId===hydrantId && b.date===date && resourceHoldsWater(b)).reduce((sum,b)=>sum+Number(b.size),0);
}
export function subsidyMonthUsed(store, customerId, date, excludingId=null) {
  return store.bookings.filter(b=>b.id!==excludingId && b.customerId===customerId && subsidyCounts(b) && monthOf(b.date)===monthOf(date)).length;
}
export function eligibleTankers(store, booking) {
  return store.tankers.filter(t=>t.hydrantId===booking.hydrantId && t.size===Number(booking.size) && t.status==='Available' && !store.bookings.some(b=>b.id!==booking.id && b.tankerId===t.id && resourcesReserved(b) && overlaps(b,booking,store.config.slotMinutes)));
}
export function eligibleDrivers(store,booking) {
  return store.users.filter(u=>u.role==='Driver' && u.status==='Active' && u.hydrantId===booking.hydrantId && !store.bookings.some(b=>b.id!==booking.id && b.driverId===u.id && resourcesReserved(b) && overlaps(b,booking,store.config.slotMinutes)));
}
export function validateBooking(store, customer, data, {approving=false, excludingId=null}={}) {
  const fields=requireFields(data,['hydrantId','size','date','slotTime','address','type']);
  const hydrant=store.hydrants.find(h=>h.id===data.hydrantId);
  if (!hydrant || !hydrant.zoneIds.includes(customer.zoneId)) fields.hydrantId='This hydrant does not serve your zone.';
  else if (hydrant.status!=='Available') fields.hydrantId='This hydrant is unavailable.';
  const rate=store.rates.find(r=>r.size===Number(data.size));
  if (!rate) fields.size='Select a valid tanker size.';
  if (data.type && !['commercial','subsidised'].includes(data.type)) fields.type='Invalid booking type.';
  if (data.date && (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(`${data.date}T12:00:00`)) || data.date<localISO())) fields.date='Choose today or a future date.';
  if (hydrant && data.slotTime) {
    const start=minutes(data.slotTime), slot=store.config.slotMinutes;
    if (!/^\d{2}:\d{2}$/.test(data.slotTime) || start < minutes(hydrant.openTime) || start+slot > minutes(hydrant.closeTime)) fields.slotTime=`Allow ${slot} minutes inside ${hydrant.openTime}–${hydrant.closeTime}.`;
    if (start % 30!==0) fields.slotTime='Choose a 30-minute start time.';
    if (data.date===localISO()) {const now=new Date();if (start<=now.getHours()*60+now.getMinutes()) fields.slotTime='Choose a future time today.';}
  }
  if (data.type==='subsidised') {
    if (customer.subsidyStatus!=='Approved') fields.type='Your subsidy application must be approved first.';
    if (data.date && subsidyMonthUsed(store,customer.id,data.date,excludingId)>=Number(customer.monthlyLimit||store.config.defaultMonthlySubsidyLimit)) fields.type='Monthly subsidised booking limit reached.';
  }
  if (hydrant && data.date && rate && data.slotTime && (data.type==='commercial'||approving)) {
    if (quotaUsed(store,hydrant.id,data.date,excludingId)+Number(data.size)>Number(hydrant.quotaDaily)) fields.hydrantId='Daily hydrant water quota would be exceeded.';
  }
  if (Object.keys(fields).length) invalid('Please correct the booking fields.',fields);
  return {hydrant,rate};
}
export function validateProof(data) {
  const fields=requireFields(data,['proofType','proofReference']);
  if (data.proofDataUrl && String(data.proofDataUrl).length>900000) fields.proofFile='Attachment is too large for this demo (max 600 KB).';
  if(Object.keys(fields).length) invalid('Provide valid subsidy proof details.',fields);
}
export function requireActor(store,actor,roles=[]) {
  const user=store.users.find(u=>u.id===actor?.userId && u.status==='Active');
  if (!user) throw new RuleError('Your session is no longer valid.',401);
  if (roles.length && !roles.includes(user.role)) throw new RuleError('You do not have permission for this action.',403);
  return user;
}
export function activeStatus(b,statuses) { if (!statuses.includes(b.status)) throw new RuleError(`Action unavailable while booking is ${b.status}.`,409); }
