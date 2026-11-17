// THE ONLY MODULE THAT CALLS fetch(). Change this ONE base URL for phase 2.
// A real server must implement GET /bootstrap, POST /actions, POST /auth/login
// exactly as documented in docs/API_CONTRACT.md.
const API_BASE_URL = '../../mock-api';
const IS_MOCK = API_BASE_URL === '../../mock-api';
const BASE = new URL(API_BASE_URL.replace(/\/?$/, '/'), import.meta.url).href;
const STORE_KEY = 'paanilink:demo:v1';
const COLLECTIONS=['config','zones','hydrants','tankers','rates','users','bookings','applications','disputes'];
let seedPromise;
const copy=x=>structuredClone(x);
function normalize(store) {
  // Seed offsets make demo's upcoming and past bookings work on any date.
  const dateOffset=n=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+Number(n));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  store.bookings.forEach(b=>{if(b.offsetDays!==undefined){b.date=dateOffset(b.offsetDays);delete b.offsetDays;}});
  store.applications.forEach(a=>{if(a.submittedOffsetDays!==undefined){a.submittedAt=`${dateOffset(a.submittedOffsetDays)}T09:00:00`;delete a.submittedOffsetDays;}});
  store.disputes.forEach(d=>{if(d.createdOffsetDays!==undefined){d.createdAt=`${dateOffset(d.createdOffsetDays)}T10:00:00`;delete d.createdOffsetDays;}});
  return store;
}
async function jsonFetch(path, options={}) {
  const res=await fetch(new URL(path.replace(/^\//,''),BASE),{credentials:'include',headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});
  let data; try{data=await res.json();}catch{data={message:`Server returned an unreadable response (${res.status}).`};}
  if(!res.ok){const e=new Error(data.message||`Request failed (${res.status})`);e.status=res.status;e.fields=data.fields||{};throw e;}
  return data;
}
async function seed() {
  if(!seedPromise) seedPromise=Promise.all(COLLECTIONS.map(async key=>[key,await jsonFetch(`${key}.json`)])).then(parts=>normalize(Object.fromEntries(parts))).catch(e=>{seedPromise=null;throw e;});
  return seedPromise;
}
async function getMockState() {
  const base=await seed();
  try {const saved=localStorage.getItem(STORE_KEY);return saved?JSON.parse(saved):copy(base);}
  catch {return copy(base);}
}
export async function getBootstrap() {
  if (!IS_MOCK) return jsonFetch('bootstrap');
  return getMockState();
}
export async function login(email,password) {
  if(!IS_MOCK) return jsonFetch('auth/login',{method:'POST',body:JSON.stringify({email,password})});
  const store=await getMockState(); const user=store.users.find(u=>u.email.toLowerCase()===String(email).trim().toLowerCase()&&u.password===password&&u.status==='Active');
  if(!user){const e=new Error('Invalid login or inactive account.');e.status=401;throw e;}
  return {user:{id:user.id,name:user.name,role:user.role}};
}
export async function action(type,payload={},actor=null) {
  if(!IS_MOCK) return jsonFetch('actions',{method:'POST',body:JSON.stringify({type,payload})});
  // Click -> action() -> fresh mock state -> validate transition -> persist -> UI reload.
  const {executeMock}=await import('./mock-engine.js');
  const {store,result}=executeMock(await getMockState(),type,payload,actor);
  try {localStorage.setItem(STORE_KEY,JSON.stringify(store));}
  catch {throw new Error('Browser demo storage is full. Remove the proof attachment or reset demo data.');}
  return result;
}
export async function logout() {
  if(!IS_MOCK) return jsonFetch('auth/logout',{method:'POST',body:JSON.stringify({})});
  return {ok:true};
}
export async function resetDemo() {
  if(!IS_MOCK) throw new Error('Reset is available in mock mode only.');
  localStorage.removeItem(STORE_KEY);
  seedPromise=null;await seed();
}
export const mockMode=IS_MOCK;
