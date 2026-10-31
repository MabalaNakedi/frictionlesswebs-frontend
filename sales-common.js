const SALES_API=(window.FW_API_URL||'').replace(/\/$/,'');
const salesApi=async(path,opts={})=>{
  const token=localStorage.getItem(opts.admin?'fw_token':'fw_sales_token');
  const r=await fetch(`${SALES_API}${path}`,{
    ...opts,
    headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'Something went wrong.');
  return d;
};
const smoney=n=>'R'+Number(n||0).toLocaleString('en-ZA',{maximumFractionDigits:2});
const sflash=(el,msg,bad=false)=>{el.textContent=msg;el.className='sales-notice'+(bad?' bad':'');el.classList.remove('sales-hidden')};
