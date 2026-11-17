export function localISO(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
export function offsetDate(days, date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + Number(days));
  return localISO(d);
}
export const minutes = hhmm => {
  const [h,m] = String(hhmm || '00:00').split(':').map(Number);
  return h*60 + m;
};
export const overlaps = (a,b,duration=90) => a.date===b.date && minutes(a.slotTime) < minutes(b.slotTime)+duration && minutes(b.slotTime) < minutes(a.slotTime)+duration;
export const monthOf = isoDate => String(isoDate).slice(0,7);
export const dateLabel = iso => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'}) : '—';
export const cash = n => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;
export const nowStamp = () => new Date().toISOString();
export const humanStamp = iso => iso ? new Date(iso).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'}) : '—';
