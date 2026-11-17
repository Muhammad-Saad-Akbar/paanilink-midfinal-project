const KEY='paanilink:session';
export const rolePaths={'Customer':'customer.html','Zone Officer':'officer.html','Hydrant Operator':'operator.html','Driver':'driver.html','Administrator':'admin.html'};
export function getSession(){try {return JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{return null;}}
export function setSession(user){sessionStorage.setItem(KEY,JSON.stringify({userId:user.id,role:user.role}));}
export function signOut(){sessionStorage.removeItem(KEY);location.href='../index.html';}
export function roleURL(role,fromRoot=false){return `${fromRoot?'pages/':''}${rolePaths[role]||'customer.html'}`;}
