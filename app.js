const API = (window.FW_API_URL || '').replace(/\/$/, '');
const api = path => `${API}${path}`;
const menu=document.querySelector('.menu'),links=document.querySelector('.links');
if(menu) menu.onclick=()=>links.classList.toggle('open');
document.querySelectorAll('.links a').forEach(a=>a.onclick=()=>links?.classList.remove('open'));
function token(){return localStorage.getItem('fw_token')||''}
async function request(path,options={}){
  const headers={...(options.headers||{})};
  if(token()) headers.Authorization=`Bearer ${token()}`;
  const r=await fetch(api(path),{...options,headers});
  let d={}; try{d=await r.json()}catch{}
  if(!r.ok) throw Object.assign(new Error(d.error||`Request failed (${r.status})`),{status:r.status});
  return d;
}
const form=document.querySelector('[data-contact]');
if(form) form.addEventListener('submit',async e=>{e.preventDefault();const n=form.querySelector('.notice');n.className='notice';n.textContent='Sending…';try{const d=await request('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});n.classList.add('ok');n.textContent=d.message;form.reset()}catch(err){n.classList.add('err');n.textContent=API?err.message:'Backend not connected yet. Open js/config.js and add your backend URL.'}});
async function authForm(type){const f=document.querySelector(`[data-${type}]`);if(!f)return;f.addEventListener('submit',async e=>{e.preventDefault();const n=f.querySelector('.notice');n.className='notice';n.textContent='Please wait…';try{const d=await request(`/api/${type}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});localStorage.setItem('fw_token',d.token);n.classList.add('ok');n.textContent='Success. Redirecting…';location.href=d.user.role==='admin'?'admin.html':'dashboard.html'}catch(err){n.classList.add('err');n.textContent=API?err.message:'Backend not connected yet. Open js/config.js and add your backend URL.'}})}
authForm('login');authForm('register');
async function requireUser(){const el=document.querySelector('[data-user]');if(!el)return;try{const d=await request('/api/me');el.textContent=d.user.name;const admin=document.querySelector('[data-admin-link]');if(admin&&d.user.role==='admin')admin.hidden=false}catch{location.href='login.html'}}
requireUser();
document.querySelectorAll('[data-logout]').forEach(b=>b.onclick=()=>{localStorage.removeItem('fw_token');location.href='index.html'});
async function loadMessages(){const box=document.querySelector('[data-messages]');if(!box)return;try{const d=await request('/api/admin/messages');box.innerHTML=d.messages.length?d.messages.map(m=>`<article class="message"><strong>${esc(m.name)}</strong> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a><br><small>${new Date(m.createdAt).toLocaleString()} ${m.company?' · '+esc(m.company):''} ${m.budget?' · '+esc(m.budget):''}</small><p>${esc(m.message)}</p></article>`).join(''):'<p class="muted">No enquiries yet.</p>'}catch{location.href='login.html'}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
loadMessages(); 



