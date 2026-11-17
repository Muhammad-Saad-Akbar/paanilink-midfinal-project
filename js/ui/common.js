import {cash,dateLabel,humanStamp} from '../utils/time.js';
import {rolePaths} from '../utils/auth.js';
export const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const one=(rows,key,value)=>rows.find(r=>r[key]===value);
export const nameOf=(state,key,id,field='name')=>one(state[key]||[],'id',id)?.[field]||'Unassigned';
export const badge=(v)=>`<span class="badge badge-${e(String(v).toLowerCase().replaceAll(' ','-'))}">${e(v)}</span>`;
export const heading=(eyebrow,title,sub='')=>`<div class="page-heading"><div><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1>${sub?`<p class="muted">${e(sub)}</p>`:''}</div></div>`;
export const stat=(label,value,note='',tone='')=>`<article class="stat-card ${e(tone)}"><div class="stat-label">${e(label)}</div><div class="stat-value">${e(value)}</div>${note?`<p>${e(note)}</p>`:''}</article>`;
export const panel=(title,body,subtitle='',extra='')=>`<section class="panel"><div class="panel-head"><div><h2>${e(title)}</h2>${subtitle?`<p class="muted">${e(subtitle)}</p>`:''}</div>${extra}</div>${body}</section>`;
export const empty=(title='Nothing here yet',sub='Records will appear here when available.')=>`<div class="empty-state"><span aria-hidden="true">◌</span><strong>${e(title)}</strong><p>${e(sub)}</p></div>`;
export const btn=(text,command,id='',cls='secondary')=>`<button class="btn ${e(cls)}" type="button" data-open="${e(command)}" data-id="${e(id)}">${e(text)}</button>`;
export const field=(label,name,content,help='')=>`<div class="field"><label for="f-${e(name)}">${e(label)}</label>${content}${help?`<small class="hint">${e(help)}</small>`:''}<small class="field-error" id="error-${e(name)}" data-error="${e(name)}" role="alert"></small></div>`;
export const input=(name,type='text',value='',attrs='')=>`<input id="f-${e(name)}" name="${e(name)}" type="${e(type)}" value="${e(value)}" ${attrs}>`;
export const textArea=(name,value='',attrs='')=>`<textarea id="f-${e(name)}" name="${e(name)}" rows="3" ${attrs}>${e(value)}</textarea>`;
export const select=(name,options,value='',attrs='')=>`<select id="f-${e(name)}" name="${e(name)}" ${attrs}>${options.map(o=>`<option value="${e(o.value)}" ${String(o.value)===String(value)?'selected':''}>${e(o.label)}</option>`).join('')}</select>`;
export const opts=(items,valueKey='id',labelKey='name',blank='Select an option')=>[{value:'',label:blank},...items.map(item=>({value:item[valueKey],label:item[labelKey]}))];
export const foot=label=>`<div class="form-actions"><button class="btn primary" type="submit">${e(label)}</button></div>`;
export const table=(headers,rows,emptyMessage='No records found.')=>rows.length?`<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty(emptyMessage);
export const tr=cols=>`<tr>${cols.map(col=>`<td>${col}</td>`).join('')}</tr>`;
export const bookingTable=(s,bookings,{actions=()=>'',includeCustomer=false,includeHydrant=true}={})=>table(['Booking',...(includeCustomer?['Customer']:[]),'Date / slot','Tanker size',...(includeHydrant?['Hydrant']:[]),'Type','Status','Actions'],bookings.map(b=>tr([
  `<button type="button" class="text-link" data-open="detail" data-id="${e(b.id)}">${e(b.id)}</button>`,
  ...(includeCustomer?[e(nameOf(s,'users',b.customerId))]:[]),
  `${e(dateLabel(b.date))}<br><small>${e(b.slotTime)}</small>`,
  `${Number(b.size).toLocaleString()} gal`,
  ...(includeHydrant?[e(nameOf(s,'hydrants',b.hydrantId))]:[]),
  e(b.type),badge(b.status),`<div class="row-actions">${actions(b)}${btn('View','detail',b.id,'ghost sm')}</div>`
])),'No bookings match this view.');
export const summaryStrip=entries=>`<div class="stats-grid">${entries.map(x=>stat(...x)).join('')}</div>`;
export const visibleBookings=(s,u)=>s.bookings.filter(b=>u.role==='Customer'?b.customerId===u.id:u.role==='Zone Officer'?b.zoneId===u.zoneId:u.role==='Hydrant Operator'?b.hydrantId===u.hydrantId:u.role==='Driver'?b.driverId===u.id:true).sort((a,b)=>b.date.localeCompare(a.date)||b.slotTime.localeCompare(a.slotTime));
export const statusTimeline=b=>`<ol class="timeline">${(b.history||[]).map((item,i)=>`<li class="timeline-step"><span class="timeline-dot" aria-hidden="true"></span><div><strong>${e(item.status)}</strong><small>${e(humanStamp(item.at))}</small>${item.note?`<p>${e(item.note)}</p>`:''}</div></li>`).join('')}</ol>`;
export function bookingDetail(s,b,u) {
  const customer=nameOf(s,'users',b.customerId);
  const tanker=b.tankerId?nameOf(s,'tankers',b.tankerId,'plate'):'Not assigned';
  const driver=b.driverId?nameOf(s,'users',b.driverId):'Not assigned';
  const showDriver=u.role!=='Customer'||b.status!=='Pending';
  return `<div class="detail-summary"><div class="detail-head"><h3>${e(b.id)}</h3>${badge(b.status)}</div><dl class="definition-grid">
  <div><dt>Customer</dt><dd>${e(customer)}</dd></div><div><dt>Scheduled</dt><dd>${e(dateLabel(b.date))} · ${e(b.slotTime)}</dd></div>
  <div><dt>Zone</dt><dd>${e(nameOf(s,'zones',b.zoneId))}</dd></div><div><dt>Hydrant</dt><dd>${e(nameOf(s,'hydrants',b.hydrantId))}</dd></div>
  <div><dt>Water</dt><dd>${Number(b.size).toLocaleString()} gallons</dd></div><div><dt>Rate</dt><dd>${e(cash(b.amount))}</dd></div>
  <div><dt>Booking type</dt><dd>${e(b.type)}</dd></div><div><dt>Tanker</dt><dd>${e(tanker)}</dd></div>
  ${showDriver?`<div><dt>Assigned driver</dt><dd>${e(driver)}</dd></div>`:''}<div><dt>Delivery address</dt><dd>${e(b.address)}</dd></div>
  </dl>${b.failureReason?`<p class="notice warning"><strong>Failure reason:</strong> ${e(b.failureReason)}</p>`:''}</div>
  <h4 class="section-subtitle">Traceable delivery timeline</h4>${statusTimeline(b)}`;
}
export const navbar=(s,u,page,tab,links)=>`<aside class="sidebar" aria-label="Primary navigation"><a class="brand" href="${e(rolePaths[u.role])}"><span class="brand-mark">◈</span><span>Paani<span>Link</span><small>City Water Board</small></span></a><p class="nav-caption">WORKSPACE</p><nav class="nav-list">${links.map(x=>`<button type="button" class="nav-item ${tab===x.id?'active':''}" data-tab="${e(x.id)}" aria-current="${tab===x.id?'page':'false'}"><span class="nav-glyph">${e(x.glyph)}</span>${e(x.label)}</button>`).join('')}</nav><div class="sidebar-end"><div class="sidebar-note"><span class="online-dot"></span> Frontend demonstration</div><button class="btn ghost" type="button" data-logout>Log out ↗</button></div></aside>`;
export const shell=(s,u,page,tab,links,content)=>`<div class="app-shell">${navbar(s,u,page,tab,links)}<div class="app-main"><header class="topbar"><div class="topbar-left"><span class="topbar-mark">◈</span><span>PAANILINK <span class="topbar-path"> / ${e(u.role)}</span></span></div><div class="topbar-right"><span class="role-pill">${e(u.role)}</span><div class="avatar">${e(u.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</div><span class="user-name">${e(u.name)}</span></div></header><main id="main-content" tabindex="-1" class="content">${content}</main><footer class="app-footer"><span>PAANILINK / PHASE 01</span><span>Water delivery, accounted for.</span></footer></div></div><dialog id="app-dialog" aria-labelledby="dialog-heading"><div id="dialog-content"></div></dialog><div id="toast" aria-live="polite" role="status"></div>`;
