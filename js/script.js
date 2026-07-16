/* ─── STATE ─────────────────────────── */
let FD = {vas_lines:[],oem_lines:[],dealer_sigs:{},ew_optout:'No',sp_optout:'No',ppf_optout:'No'};
let editingId = null;
let pendingDeleteId = null;

/* ─── VIEW SWITCHING ────────────────── */
function switchView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  const isRec = v==='records';
  document.getElementById('btn-rec-nav').classList.toggle('hidden',isRec);
  document.getElementById('btn-form-nav').classList.toggle('hidden',!isRec);
  document.getElementById('btn-draft').classList.toggle('hidden',isRec);
  document.getElementById('btn-submit').classList.toggle('hidden',isRec);
  document.querySelector('.subnav').style.display = isRec?'none':'';
  if(isRec) renderRecords();
}

function newForm(){
  resetFormData();
  switchView('form');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ─── SECTION TOGGLE ────────────────── */
function toggleSec(headEl){headEl.parentElement.classList.toggle('collapsed')}

/* ─── SECTION NAV SCROLL ─────────────── */
function scrollSec(n){
  const el=document.getElementById('sec-'+n);
  if(!el||el.classList.contains('hidden')) return;
  el.classList.remove('collapsed');
  const y=el.getBoundingClientRect().top+window.scrollY-140;
  window.scrollTo({top:y,behavior:'smooth'});
  setActiveNav(n);
}
function setActiveNav(n){
  document.querySelectorAll('.snav-item').forEach(i=>i.classList.remove('active'));
  const p=document.querySelector('[data-target="'+n+'"]');
  if(p) p.classList.add('active');
}
window.addEventListener('scroll',()=>{
  if(!document.getElementById('view-form').classList.contains('active')) return;
  const secs=document.querySelectorAll('#view-form .section:not(.hidden)');
  let best=null,bestY=Infinity;
  secs.forEach(s=>{const r=s.getBoundingClientRect(),d=Math.abs(r.top-150);if(d<bestY){bestY=d;best=s;}});
  if(best) setActiveNav(best.dataset.sec);
},{passive:true});

/* ─── PAYMENT MODE SELECTS ──────────── */
const PM_OPTS=['— Select —','Cash','UPI / E-Wallet','Bank Transfer','MB Disbursement','Cheque','Card','Other'];
const PM_REF_REQUIRED=['UPI / E-Wallet','Bank Transfer','Cheque'];
function buildPmSel(id,dk){
  const s=document.getElementById(id);
  if(!s) return;
  s.dataset.k=dk;
  s.onchange=()=>onField(s);
  PM_OPTS.forEach(opt=>{const o=document.createElement('option');o.value=opt==='— Select —'?'':opt;o.textContent=opt;s.appendChild(o);});
}
buildPmSel('sel-pm-exshow','pm_exshow');
buildPmSel('sel-pm-reg','pm_reg');buildPmSel('sel-pm-ins','pm_ins');
buildPmSel('sel-pm-acc','pm_acc');
buildPmSel('sel-pm-cn','pm_cn');buildPmSel('sel-pm-oth','pm_oth');

/* ═══════════════════════════════════════════════════════
   MULTI-SELECT LINE ITEMS — Value Added Services & OEM/Month Offer
   ═══════════════════════════════════════════════════════
   FD.vas_lines / FD.oem_lines: [{id, service, amount, payment_mode, reference, received}]
   Each selected chip = exactly one line item row. Removing a chip
   removes its line item (and vice versa via the row's delete button).
═══════════════════════════════════════════════════════ */
const VAS_OPTIONS=['Extended Warranty','Service Package','PPF (Paint Protection Film)','Pending Accessory (if any)','Fast Tag','Other','Maintenance Package Compact','Green Cess (if applicable)','RSA'];
const OEM_OFFER_OPTIONS=['Cash Discount','Exchange Discount','Corporate Discount','Loyalty Bonus','Festive / Seasonal Offer','Other Offer'];
let _msLineSeq=1;

const MS_CONFIG={
  vas:{options:VAS_OPTIONS, dataArr:'vas_lines', rowsId:'vas-line-rows',
       selectId:'ms-select-vas', panelId:'ms-panel-vas',
       placeholder:'+ Select service(s)', particularLabel:'Service'},
  oem:{options:OEM_OFFER_OPTIONS, dataArr:'oem_lines', rowsId:'oem-line-rows',
       selectId:'ms-select-oem', panelId:'ms-panel-oem',
       placeholder:'+ Select offer type(s)', particularLabel:'Offer Type'},
};

function msSelectedValues(key){
  const cfg=MS_CONFIG[key];
  return (FD[cfg.dataArr]||[]).map(l=>l.service);
}

function renderMsPanel(key){
  const cfg=MS_CONFIG[key];
  const panel=document.getElementById(cfg.panelId);
  if(!panel) return;
  const selected=msSelectedValues(key);
  panel.innerHTML=cfg.options.map(opt=>{
    const isSel=selected.includes(opt);
    return `<div class="ms-opt${isSel?' sel':''}" onclick="toggleMsOption('${key}', this.dataset.opt)" data-opt="${esc(opt)}">
      <input type="checkbox" ${isSel?'checked':''}><span>${esc(opt)}</span>
    </div>`;
  }).join('');
}

function toggleMsPanel(key){
  const cfg=MS_CONFIG[key];
  const sel=document.getElementById(cfg.selectId);
  const panel=document.getElementById(cfg.panelId);
  const willOpen=!panel.classList.contains('open');
  // Close any other open panels first
  Object.keys(MS_CONFIG).forEach(k=>{
    document.getElementById(MS_CONFIG[k].panelId).classList.remove('open');
    document.getElementById(MS_CONFIG[k].selectId).classList.remove('open');
  });
  if(willOpen){
    renderMsPanel(key);
    panel.classList.add('open');
    sel.classList.add('open');
  }
}
document.addEventListener('click',function(e){
  Object.keys(MS_CONFIG).forEach(k=>{
    const wrap=document.getElementById('ms-wrap-'+k);
    if(wrap && !wrap.contains(e.target)){
      document.getElementById(MS_CONFIG[k].panelId).classList.remove('open');
      document.getElementById(MS_CONFIG[k].selectId).classList.remove('open');
    }
  });
});

function toggleMsOption(key,optValue){
  const cfg=MS_CONFIG[key];
  if(!FD[cfg.dataArr]) FD[cfg.dataArr]=[];
  const arr=FD[cfg.dataArr];
  const idx=arr.findIndex(l=>l.service===optValue);
  if(idx===-1){
    arr.push({id:_msLineSeq++, service:optValue, amount:'', payment_mode:'', reference:'', received:''});
  } else {
    arr.splice(idx,1);
  }
  renderMsPanel(key);
  renderChips(key);
  renderLineRows(key);
  calcAll();
}

function removeMsLine(key,lineId){
  const cfg=MS_CONFIG[key];
  const arr=FD[cfg.dataArr]||[];
  const idx=arr.findIndex(l=>l.id===lineId);
  if(idx!==-1) arr.splice(idx,1);
  renderMsPanel(key);
  renderChips(key);
  renderLineRows(key);
  calcAll();
}

function renderChips(key){
  // Chips are no longer used — rows are injected directly into the main table.
  // Just keep the dropdown label in sync.
  const cfg=MS_CONFIG[key];
  const arr=FD[cfg.dataArr]||[];
  const ph=document.querySelector('#'+cfg.selectId+' .ms-ph');
  if(ph) ph.textContent=arr.length?`${arr.length} selected — click to add more`:cfg.placeholder;
}

function renderLineRows(key){
  const cfg=MS_CONFIG[key];
  const tbody=document.getElementById(cfg.rowsId);
  const arr=FD[cfg.dataArr]||[];
  tbody.innerHTML=arr.map(l=>{
    return `<tr data-line-id="${l.id}" class="ms-injected-row">
      <td>
        <span class="ms-injected-label">${esc(l.service)}</span>
        <button class="del-btn" onclick="removeMsLine('${key}',${l.id})" title="Remove">✕</button>
      </td>
      <td><input type="number" min="0" step="0.01" value="${esc(l.amount)}" placeholder="0.00"
        oninput="onMsLineField('${key}',${l.id},'amount',this)"></td>
    </tr>`;
  }).join('');
}

function onMsLineField(key,lineId,field,el){
  const cfg=MS_CONFIG[key];
  const arr=FD[cfg.dataArr]||[];
  const line=arr.find(l=>l.id===lineId);
  if(!line) return;
  let val=el.value;
  // Guard: Amount / Amount Received must be numeric and >= 0
  if((field==='amount'||field==='received') && val!==''){
    let n=parseFloat(val);
    if(isNaN(n)) n=0;
    if(n<0) n=0;
    val=n;
    el.value=n;
  }
  line[field]=val;
  if(field==='payment_mode') renderLineRows(key); // re-render to show/hide mandatory-reference state
  calcAll();
}

function msLineTotal(key,field){
  const arr=FD[MS_CONFIG[key].dataArr]||[];
  return arr.reduce((s,l)=>s+(parseFloat(l[field])||0),0);
}

/* ─── FIELD LOGIC ───────────────────── */
function onField(el){const k=el.dataset.k;if(k) FD[k]=el.value;validateField(el);}
function autoSizeConditionSelect(sel){
  const opt=sel.options[sel.selectedIndex];
  const text=opt?opt.text:'';
  let measurer=document.getElementById('__condition-select-measurer');
  if(!measurer){
    measurer=document.createElement('span');
    measurer.id='__condition-select-measurer';
    measurer.style.position='absolute';
    measurer.style.top='-9999px';
    measurer.style.left='-9999px';
    measurer.style.visibility='hidden';
    measurer.style.whiteSpace='pre';
    document.body.appendChild(measurer);
  }
  const cs=getComputedStyle(sel);
  measurer.style.font=cs.font;
  measurer.textContent=text;
  const MIN_W=140,MAX_W=420,PADDING=44;
  let w=measurer.offsetWidth+PADDING;
  w=Math.max(MIN_W,Math.min(MAX_W,w));
  sel.style.width=w+'px';
}
document.addEventListener('DOMContentLoaded',function(){
  ['cash-condition-select','cheque-condition-select','online-condition-select','bankdd-condition-select','po-condition-select','tradevalue-condition-select'].forEach(function(id){
    const el=document.getElementById(id);
    if(el) autoSizeConditionSelect(el);
  });
});
function toggleCashAmountEnable(sel){
  const inp=document.getElementById('pmt-cash-amount-input');
  if(!inp)return;
  if(sel.value){
    inp.disabled=false;
  }else{
    inp.disabled=true;
    inp.value='';
    FD['pmt_cash_amount']='';
    if(typeof calcPmtTotal==='function') calcPmtTotal();
  }
}

function validateField(el){
  const k=el.dataset.k;const grp=el.closest('.fgrp');if(!grp) return;
  let v=true;
  if(k==='customer_name') v=el.value.trim().length>0;
  if(k==='mobile_no') v=el.value===''||/^[6-9]\d{9}$/.test(el.value);
  if(k==='email_id') v=el.value===''||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value);
  if(k==='aadhaar_no') v=el.value===''||/^\d{12}$/.test(el.value);
  if(k==='sales_transaction_no') v=el.value.trim().length>0;
  if(k==='model') v=el.value.trim().length>0;
  if(k==='vin_number') v=el.value===''||el.value.length===17;
  if(k==='customer_type') v=el.value.trim().length>0;
  if(k==='pan_no') v=el.value===''||/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(el.value.toUpperCase());
  if(k==='gst_no') v=el.value===''||/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(el.value.toUpperCase());
  grp.classList.toggle('invalid',!v);
}

/* ─── CONDITIONAL: CUSTOMER TYPE ────── */
function onCustomerType(el){
  const gst=['Corporate','Leasing'].includes(el.value);
  document.getElementById('fld-aadhaar_no').classList.toggle('hidden',gst);
  document.getElementById('fld-gst_no').classList.toggle('hidden',!gst);
  if(gst){const a=document.querySelector('[data-k="aadhaar_no"]');if(a){a.value='';FD.aadhaar_no='';a.closest('.fgrp').classList.remove('invalid');}}
  else{const g=document.querySelector('[data-k="gst_no"]');if(g){g.value='';FD.gst_no='';g.closest('.fgrp').classList.remove('invalid');}}
}

/* ─── CONDITIONAL: FINANCE TYPE ─────── */
function onFinanceType(el){
  FD.finance_type=el.value;
  const cash=el.value==='Cash Purchase'||el.value==='';
  const financeInputs=['inp-bank-s2','inp-bank-s4','inp-fpf','inp-loan-amt','inp-tenure'];
  financeInputs.forEach(id=>{
    const inp=document.getElementById(id);
    if(!inp) return;
    inp.disabled=cash;
    if(cash){inp.value='';FD[inp.dataset.k]='';}
  });
  const ftDisp=document.querySelector('[data-k="finance_type_display"]');
  if(ftDisp){ftDisp.value=el.value;FD.finance_type_display=el.value;}
  document.getElementById('finance-note').style.display=cash?'':'none';
  document.getElementById('sec-4').classList.toggle('hidden',cash);
  calcAll();
}

/* ─── CONDITIONAL: EXCHANGE TOGGLE ──── */
function onExchangeToggle(el){
  FD.exchange_applicable=el.value;
  const show=el.value==='Yes';
  const s=document.getElementById('sec-3');
  s.classList.toggle('hidden',!show);
  if(show) s.classList.remove('collapsed');
  calcAll();
}

/* ─── CALCULATIONS ──────────────────── */
function num(k){return parseFloat(FD[k])||0;}
function fmt(n){return n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
function setEl(id,v){const e=document.getElementById(id);if(e) e.textContent=v;}

function calcAll(){
  // Sync FPF from S4 input
  const fpfInp=document.getElementById('inp-fpf');
  if(fpfInp) FD.finance_processing_fee=fpfInp.value;
  const fpfLink=document.getElementById('link-fpf');if(fpfLink) fpfLink.textContent=fmt(num('finance_processing_fee'));

  // Part A — OEM/Month Offer is now the sum of all selected offer line items
  const exShow=num('ex_showroom_price');
  const lessOEM=msLineTotal('oem','amount');
  const lessOEMRec=msLineTotal('oem','received');
  const afterOffer=exShow-lessOEM;
  const tcs=num('tcs_amount');
  const totalA=afterOffer+tcs;
  const totalARec=num('ex_showroom_received')+lessOEMRec;
  setEl('calc-after-offer',fmt(afterOffer));
  setEl('calc-total-a','₹'+fmt(totalA));
  setEl('calc-total-a-rec','₹'+fmt(totalARec));
  setEl('calc-gap-a','₹'+fmt(lessOEM));

  // Part B — Value Added Services is now the sum of all selected service line items
  const vasAmt=msLineTotal('vas','amount');
  const vasRec=msLineTotal('vas','received');
  const bKeys=['reg_road_tax','insurance_amount','accessories_total','finance_processing_fee','choice_number_amt','other_charges'];
  const bRecKeys=['reg_road_tax_received','insurance_received','accessories_received','fpf_received','choice_number_received','other_charges_received'];
  const totalB=bKeys.reduce((s,k)=>s+num(k),0)+vasAmt;
  const totalBRec=bRecKeys.reduce((s,k)=>s+num(k),0)+vasRec;
  setEl('calc-total-b','₹'+fmt(totalB));
  setEl('calc-total-b-rec','₹'+fmt(totalBRec));
  setEl('calc-gap-b','₹'+fmt(totalB-totalBRec));

  // Grand
  const grand=totalA+totalB;
  setEl('calc-grand','₹'+fmt(grand));
  FD._grandTotal=grand;
  // Grand Total Received = Grand Total Payable − Total Amount Received (Section 6)
  calcPmtTotal();
}

/* ─── DEALER SIGN-OFF ───────────────── */
const DEALER_ROLES=['Sales Executive','Sales Head','Accounts','Finance','Accessories Manager','Witness / Auditor'];
function renderDealerSigs(){
  document.getElementById('dealer-sig-grid').innerHTML=DEALER_ROLES.map(role=>{
    const rk=role.toLowerCase().replace(/[\s/]+/g,'_');
    return `<div class="sig-card">
      <div class="sig-role">${role}</div>
      <div class="fgrp" style="margin-bottom:7px"><label class="flbl">Name</label><input class="finp" placeholder="Full name" onchange="FD.dealer_sigs['${rk}_name']=this.value"></div>
      <div class="fgrp" style="margin-bottom:7px"><label class="flbl">Designation</label><input class="finp" placeholder="Designation" value="${role}" onchange="FD.dealer_sigs['${rk}_designation']=this.value"></div>
      <div class="fgrp" style="margin-bottom:7px"><label class="flbl">Signature</label><input class="finp" placeholder="Signature" onchange="FD.dealer_sigs['${rk}_sig']=this.value"></div>
      <div class="fgrp"><label class="flbl">Date</label><input class="finp" type="date" onchange="FD.dealer_sigs['${rk}_date']=this.value"></div>
    </div>`;}).join('');
}

/* ─── OPT-OUT BLOCKS ────────────────── */
function optOutBlock(num,title,decl,key){
  return `<div class="optout-block">
    <div class="optout-title">${num}. ${title}</div>
    <div class="decl-box" style="font-size:11.5px">${decl}</div>
    <div class="fg2">
      <div class="fgrp">
        <label class="flbl">Has the customer opted out?</label>
        <div class="rg" style="margin-top:5px">
          <label class="rl"><input type="radio" name="${key}" value="Yes" onchange="FD['${key}']='Yes';toggleOptDate('${key}',true)"> &nbsp;Yes — Opted out</label>
          <label class="rl"><input type="radio" name="${key}" value="No" checked onchange="FD['${key}']='No';toggleOptDate('${key}',false)"> &nbsp;No</label>
        </div>
      </div>
      <div class="fgrp ${key}-date hidden"><label class="flbl">Customer Signature / Date</label><input class="finp" type="date" onchange="FD['${key}_date']=this.value"></div>
    </div>
  </div>`;
}
function toggleOptDate(key,show){document.querySelectorAll('.'+key+'-date').forEach(e=>e.classList.toggle('hidden',!show));}

/* ─── ALERT ──────────────────────────── */
function showAlert(type,msg){
  const b=document.getElementById('alert-box');
  b.innerHTML=`<div class="alert alert-${type==='success'?'s':'d'}"><span>${msg}</span><span class="alert-close" onclick="this.parentElement.remove()">✕</span></div>`;
  b.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ─── SAVE / SUBMIT ──────────────────── */
function saveForm(status){
  const required=[['customer_name','Customer Name'],['mobile_no','Mobile No.'],['customer_type','Type of Customer'],['sales_transaction_no','Sales Transaction No.'],['model','Model'],['vin_number','Chassis Number']];
  if(status==='submitted'){
    const missing=required.filter(([k])=>!FD[k]||!FD[k].toString().trim());
    if(missing.length){showAlert('danger','⚠ Please complete required fields: '+missing.map(m=>m[1]).join(', '));return;}
    if(FD.mobile_no&&!/^[6-9]\d{9}$/.test(FD.mobile_no)){showAlert('danger','⚠ Mobile number must be a valid 10-digit number (starting with 6–9).');return;}
    if(FD.vin_number&&FD.vin_number.length!==17){showAlert('danger','⚠ Chassis Number must be exactly 17 characters.');return;}
    // Value Added Services / OEM Offer line items: Reference Number is
    // mandatory whenever payment mode is UPI / E-Wallet, Bank Transfer,
    // or Cheque (per spec). Cash, MB Disbursement, Card, Other do not
    // require it.
    const lineLabel={vas:'Value Added Services',oem:'OEM / Month Offer'};
    for(const key of ['vas','oem']){
      const arr=FD[MS_CONFIG[key].dataArr]||[];
      for(const line of arr){
        if(PM_REF_REQUIRED.includes(line.payment_mode) && (!line.reference||!line.reference.trim())){
          showAlert('danger',`⚠ Reference Number is required for "${line.service}" under ${lineLabel[key]} (Payment Mode: ${line.payment_mode}).`);
          return;
        }
      }
    }
  }
  syncAllFieldsToFD();
  FD.status=status;
  FD.saved_at=new Date().toISOString();
  calcAll();
  const recs=getRecords();
  if(editingId){
    const idx=recs.findIndex(r=>r.id===editingId);
    if(idx!==-1) recs[idx]={...FD,id:editingId};
    else recs.push({...FD,id:editingId});
  } else {
    const id='NDC-'+Date.now();
    editingId=id;
    if(!FD.customer_ref_no){FD.customer_ref_no=id;document.getElementById('hdr-ref').value=id;}
    recs.push({...FD,id});
  }
  localStorage.setItem('ndc_records',JSON.stringify(recs));
  showAlert('success',status==='submitted'?'✓ NDC form submitted successfully.':'💾 Draft saved. You may continue editing.');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ─── RECORDS PERSISTENCE ───────────── */
function getRecords(){try{return JSON.parse(localStorage.getItem('ndc_records')||'[]');}catch{return [];}}

function renderRecords(){
  const all=getRecords();
  const sub=all.filter(r=>r.status==='submitted');
  const gsum=sub.reduce((s,r)=>s+(r._grandTotal||0),0);
  document.getElementById('rec-kpis').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Total Records</div><div class="kpi-val">${all.length}</div><div class="kpi-sub">All NDC forms</div></div>
    <div class="kpi-card"><div class="kpi-label">Submitted</div><div class="kpi-val green">${sub.length}</div><div class="kpi-sub">Finalised &amp; submitted</div></div>
    <div class="kpi-card"><div class="kpi-label">Drafts</div><div class="kpi-val muted">${all.length-sub.length}</div><div class="kpi-sub">In progress</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Vehicle Value</div><div class="kpi-val gold" style="font-size:15px">₹${fmt(gsum)}</div><div class="kpi-sub">Submitted forms only</div></div>`;
  filterRecords(all);
}

function filterRecords(allIn){
  const all=allIn||getRecords();
  const q=(document.getElementById('rec-search').value||'').toLowerCase();
  const st=document.getElementById('rec-status-filter').value;
  const data=all.filter(r=>{
    const mq=!q||(r.customer_name||'').toLowerCase().includes(q)||(r.vin_number||'').toLowerCase().includes(q)||(r.model||'').toLowerCase().includes(q)||(r.customer_ref_no||'').toLowerCase().includes(q)||(r.mobile_no||'').includes(q);
    const ms=!st||r.status===st;
    return mq&&ms;
  }).sort((a,b)=>new Date(b.saved_at||0)-new Date(a.saved_at||0));

  const tbody=document.getElementById('rec-tbody');
  if(!data.length){
    tbody.innerHTML=`<tr><td colspan="9"><div class="rec-empty"><div class="ico">📋</div><div style="font-weight:600">No records found</div><div style="font-size:11px;margin-top:4px">Create a new NDC form or adjust your search filters.</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML=data.map(r=>`
    <tr>
      <td><span style="font-size:10.5px;font-weight:700;color:var(--t3);font-family:monospace">${r.customer_ref_no||r.id||'—'}</span></td>
      <td><div style="font-weight:600">${esc(r.customer_name||'—')}</div><div style="font-size:10px;color:var(--t3)">${esc(r.mobile_no||'')}</div></td>
      <td><div style="font-weight:600">${esc(r.model||'—')}</div><div style="font-size:10px;color:var(--t3);font-family:monospace;letter-spacing:.3px">${esc(r.vin_number||'')}</div></td>
      <td>${esc(r.dealer_name||r.dealership_name||'—')}</td>
      <td>${r.delivery_date?new Date(r.delivery_date+'T00:00:00').toLocaleDateString('en-IN'):'—'}</td>
      <td>${esc(r.finance_type||'—')}</td>
      <td style="font-weight:700">₹${fmt(r._grandTotal||0)}</td>
      <td><span class="badge ${r.status==='submitted'?'badge-submitted':'badge-draft'}">${r.status==='submitted'?'✓ Submitted':'◌ Draft'}</span></td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-dark" onclick="editRecord('${r.id}')">Edit</button>
          <button class="btn btn-xs" style="background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger-border)" onclick="openDelModal('${r.id}')">Del</button>
        </div>
      </td>
    </tr>`).join('');
}

function editRecord(id){
  const rec=getRecords().find(r=>r.id===id);
  if(!rec) return;
  resetFormData(true);
  Object.assign(FD,rec);
  // Older saved records won't have these arrays — default safely rather
  // than letting renderChips/renderLineRows crash on undefined.
  if(!Array.isArray(FD.vas_lines)) FD.vas_lines=[];
  if(!Array.isArray(FD.oem_lines)) FD.oem_lines=[];
  editingId=id;
  // Populate all fields
  document.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;
    if(FD[k]!==undefined&&FD[k]!==null) el.value=FD[k];
  });
  document.getElementById('hdr-dealer').value=FD.dealer_name||'';
  document.getElementById('hdr-ref').value=FD.customer_ref_no||'';
  // Conditionals
  if(FD.exchange_applicable==='Yes'){
    const r=document.querySelector('[name="exchange_applicable"][value="Yes"]');
    if(r) r.checked=true;
    document.getElementById('sec-3').classList.remove('hidden');
  }
  if(FD.finance_type){
    const ft=document.querySelector('[data-k="finance_type"]');
    if(ft){ft.value=FD.finance_type;onFinanceType(ft);}
  }
  calcExchangeTotal();
  renderChips('vas');renderLineRows('vas');
  renderChips('oem');renderLineRows('oem');
  calcAll();
  switchView('form');
  window.scrollTo({top:0,behavior:'smooth'});
  showAlert('success','📋 Record loaded. Make your changes and save.');
}

function resetFormData(preserveEl){
  FD={vas_lines:[],oem_lines:[],dealer_sigs:{},ew_optout:'No',sp_optout:'No',ppf_optout:'No'};
  editingId=null;
  if(preserveEl) return;
  document.querySelectorAll('[data-k]').forEach(el=>{
    if(el.type==='radio'||el.type==='checkbox') return;
    if(el.tagName==='SELECT') el.selectedIndex=0;
    else el.value='';
  });
  document.getElementById('hdr-dealer').value='';
  document.getElementById('hdr-ref').value='';
  document.getElementById('sec-3').classList.add('hidden');
  const no=document.querySelector('[name="exchange_applicable"][value="No"]');
  if(no) no.checked=true;
  const ft=document.querySelector('[data-k="finance_type"]');
  if(ft){ft.value='';onFinanceType(ft);}
  renderChips('vas');renderLineRows('vas');
  renderChips('oem');renderLineRows('oem');
  calcAll();
}

/* ─── DELETE MODAL ──────────────────── */
function openDelModal(id){
  pendingDeleteId=id;
  document.getElementById('del-overlay').classList.add('open');
}
function closeDelModal(){
  document.getElementById('del-overlay').classList.remove('open');
  pendingDeleteId=null;
}
document.getElementById('del-confirm-btn').onclick=function(){
  const recs=getRecords().filter(r=>r.id!==pendingDeleteId);
  localStorage.setItem('ndc_records',JSON.stringify(recs));
  closeDelModal();
  renderRecords();
};
document.getElementById('del-overlay').addEventListener('click',function(e){
  if(e.target===this) closeDelModal();
});

/* ─── EXCHANGE FIELD SYNC HELPERS ────── */
function syncExchangeMakeModel(){FD.exchange_make_model=[FD.exchange_make,FD.exchange_model].filter(Boolean).join(' ');}
function syncEvaluatedValue(el){FD.evaluated_value=el.value;}
function calcExchangeTotal(){
  const considered=parseFloat(FD.exchange_value_considered)||0;
  const refund=parseFloat(FD.exchange_refund_amount)||0;
  const total=considered-refund;
  FD.exchange_total_amount=total;
  const el=document.getElementById('exchange-total-amt');
  if(el) el.value=fmt(total);
}

/* ═══════════════════════════════════════════════════════
   EXCEL EXPORT / IMPORT — column names match DB schema exactly
═══════════════════════════════════════════════════════ */
const EXCEL_FIELDS=[
  ['customer_ref_no','Customer Reference Number'],['dealer_name','Dealer / Franchise Name'],
  ['customer_name','Customer Name'],['mobile_no','Mobile Number'],['email_id','Email ID'],['customer_type','Type of Customer'],
  ['aadhaar_no','Aadhaar Number'],['gst_no','GST Number'],['address','Address'],['pan_no','PAN Number'],['sc_name','SC Name'],['sc_number','SC Number'],['sales_transaction_no','Sales Transaction Number'],
  ['booking_date','Booking Date'],['delivery_date','Delivery Date'],['deal_source','Deal Source'],
  ['finance_type','Finance Type'],['delivery_type','Delivery Type'],
  ['model','Model'],['model_year','Model Year'],['variant','Variant'],['colour','Exterior Color'],['vin_number','Chassis Number'],
  ['engine_number','Engine Number'],['fuel_type','Fuel Type'],['registration_number','Registration Number'],
  ['dealership_name','Franchise Partner / Dealership Name'],
  ['finance_bank_name','Finance / Bank Name'],['insurance','Insurance Type'],
  ['exchange_applicable','Exchange Vehicle Applicable'],
  ['exchange_make','Exchange Make'],['exchange_model','Exchange Model Year'],
  ['old_car_reg_no','Old Car Registration No.'],
  ['exchange_value_considered','Exchange Total Amount'],['exchange_refund_amount','Refund Amount'],['exchange_total_amount','Total Amount'],
  ['exchange_bonus','Exchange Bonus'],['exchange_remarks','Exchange Remarks'],
  ['finance_processing_fee','Finance Processing Fee'],['loan_amount','Loan Amount'],
  ['loan_tenure','Loan Tenure (Months)'],['choice_number_value','Choice / Premium Number'],
  ['ex_showroom_price','Ex-showroom Price'],['ex_showroom_received','Ex-showroom Received'],
  ['tcs_amount','TCS Amount'],
  ['reg_road_tax','Registration / Road Tax'],['reg_road_tax_received','Registration / Road Tax Received'],
  ['insurance_amount','Insurance Amount'],['insurance_received','Insurance Received'],
  ['accessories_total','Accessories'],['accessories_received','Accessories Received'],
  ['choice_number_amt','Choice Number Amount'],['choice_number_received','Choice Number Received'],
  ['other_charges','Other Charges'],['other_charges_received','Other Charges Received'],
  ['_grandTotal','Grand Total Payable'],
  ['customer_signature','Customer Signature'],['customer_decl_name','Customer Name (Printed)'],
  ['customer_decl_date','Declaration Date'],
  ['ew_optout','Extended Warranty Opt-Out'],['sp_optout','Service Package Opt-Out'],['ppf_optout','PPF Opt-Out'],
  ['status','Status'],['saved_at','Saved At'],
];

function flattenForExcel(rec){
  const row={};
  EXCEL_FIELDS.forEach(([k,label])=>{row[label]=rec[k]??'';});
  // Benefits — concatenated into readable text columns (also kept queryable in DB as separate rows)
  row['Benefits (Nature: Description = Amount [Recorded In])']=(rec.benefits||[]).filter(b=>b.nature||b.amount)
    .map(b=>`${b.nature||''}: ${b.description||''} = ${b.amount||0} [${b.recorded_in||''}]`).join(' | ');
  // VAS / OEM line items
  row['Value Added Services (Service = Amount, Mode, Ref, Received)']=(rec.vas_lines||[])
    .map(l=>`${l.service}=${l.amount||0},${l.payment_mode||''},${l.reference||''},${l.received||0}`).join(' | ');
  row['OEM/Month Offers (Type = Amount, Mode, Ref, Received)']=(rec.oem_lines||[])
    .map(l=>`${l.service}=${l.amount||0},${l.payment_mode||''},${l.reference||''},${l.received||0}`).join(' | ');
  // Dealer sign-off — explicit columns per role
  DEALER_ROLES.forEach(role=>{
    const rk=role.toLowerCase().replace(/[\s/]+/g,'_');
    const s=rec.dealer_sigs||{};
    row[`${role} - Name`]=s[rk+'_name']||'';
    row[`${role} - Designation`]=s[rk+'_designation']||role;
    row[`${role} - Signature`]=s[rk+'_sig']||'';
    row[`${role} - Date`]=s[rk+'_date']||'';
  });
  return row;
}

function syncAllFieldsToFD(){
  document.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;
    if(!k || el.disabled) return;
    FD[k]=el.value;
  });
  FD.dealer_name=document.getElementById('hdr-dealer').value;
  FD.customer_ref_no=document.getElementById('hdr-ref').value;
  const exTog=document.querySelector('[name="exchange_applicable"]:checked');
  if(exTog) FD.exchange_applicable=exTog.value;
  calcAll();
}

function exportCurrentToExcel(){
  syncAllFieldsToFD();
  const row=flattenForExcel(FD);
  const ws=XLSX.utils.json_to_sheet([row]);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'NDC Form');
  const fname=`NDC_${(FD.customer_ref_no||FD.sales_transaction_no||'Form').replace(/[^a-zA-Z0-9_-]/g,'_')}.xlsx`;
  XLSX.writeFile(wb,fname);
  showAlert('success','📤 Excel file exported: '+fname);
}

function exportAllRecordsToExcel(){
  const all=getRecords();
  if(!all.length){showAlert('danger','⚠ No records to export.');return;}
  const rows=all.map(flattenForExcel);
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'NDC Records');
  XLSX.writeFile(wb,'NDC_All_Records_'+new Date().toISOString().slice(0,10)+'.xlsx');
  showAlert('success','📤 Exported '+all.length+' record(s) to Excel.');
}

function importExcelFile(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){showAlert('danger','⚠ The Excel file has no data rows.');return;}
      const errors=applyExcelRowToForm(rows[0]);
      if(errors.length){
        showAlert('danger','⚠ Import completed with validation issues: '+errors.join('; '));
      } else {
        showAlert('success','📥 Excel data imported successfully. Review and Save / Submit.');
      }
      calcAll();
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(err){
      showAlert('danger','⚠ Could not read the Excel file. Please check the format. ('+err.message+')');
    }
  };
  reader.readAsArrayBuffer(file);
  document.getElementById('excel-import-input').value='';
}

function applyExcelRowToForm(row){
  const errors=[];
  resetFormData(true);
  const labelToKey={}; EXCEL_FIELDS.forEach(([k,label])=>labelToKey[label]=k);
  Object.keys(row).forEach(label=>{
    const k=labelToKey[label];
    if(k) FD[k]=row[label];
  });
  // Basic validation on import
  if(FD.mobile_no && !/^[6-9]\d{9}$/.test(String(FD.mobile_no))) errors.push('Mobile Number is not a valid 10-digit number');
  if(FD.vin_number && String(FD.vin_number).length!==17) errors.push('Chassis Number is not 17 characters');
  if(FD.aadhaar_no && !/^\d{12}$/.test(String(FD.aadhaar_no))) errors.push('Aadhaar Number is not 12 digits');
  // Re-derive make/model & line arrays (kept simple — line items are not re-parsed from concatenated text)
  if(!FD.exchange_make_model) FD.exchange_make_model=[FD.exchange_make,FD.exchange_model].filter(Boolean).join(' ');
  if(!Array.isArray(FD.vas_lines)) FD.vas_lines=[];
  if(!Array.isArray(FD.oem_lines)) FD.oem_lines=[];
  // Populate visible inputs
  document.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;
    if(FD[k]!==undefined && FD[k]!==null) el.value=FD[k];
  });
  document.getElementById('hdr-dealer').value=FD.dealer_name||'';
  document.getElementById('hdr-ref').value=FD.customer_ref_no||'';
  if(FD.exchange_applicable==='Yes'){
    const r=document.querySelector('[name="exchange_applicable"][value="Yes"]');
    if(r) r.checked=true;
    document.getElementById('sec-3').classList.remove('hidden');
  }
  if(FD.finance_type){
    const ft=document.querySelector('[data-k="finance_type"]');
    if(ft){ft.value=FD.finance_type;onFinanceType(ft);}
  }
  calcExchangeTotal();
  renderChips('vas');renderLineRows('vas');
  renderChips('oem');renderLineRows('oem');
  return errors;
}

/* ─── UTILITY ───────────────────────── */
function esc(s){const d=document.createElement('div');d.textContent=String(s);return d.innerHTML;}

/* ─── PRINT HELPER ──────────────────── */
function printForm(){
  // Ensure form view is active
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-form').classList.add('active');
  // Expand every section (remove collapsed) so sec-body is visible
  document.querySelectorAll('#view-form .section').forEach(sec=>{
    sec.classList.remove('collapsed');
  });
  // Recalculate to ensure displayed values are current
  calcAll();
  calcPmtTotal();

  // ── Inject plain-text spans for all select.finp (non-VAS dropdowns) ──
  // In @media print, select.finp is hidden (display:none).
  // We insert a sibling <span class="print-val"> with the selected text
  // so the PDF shows the chosen value as clean, arrow-free plain text.
  // VAS rows (ms-injected-row) are not affected — they have no <select>.
  const injected = [];
  document.querySelectorAll('select.finp').forEach(sel => {
    const opt = sel.options[sel.selectedIndex];
    const text = opt ? opt.text : '';
    const skip = !text || text.startsWith('—') || text.startsWith('[') || text === '';
    const span = document.createElement('span');
    span.className = 'print-val';
    span.textContent = skip ? '' : text;
    sel.parentNode.insertBefore(span, sel.nextSibling);
    injected.push(span);
  });

  // Small delay so DOM settles before print dialog opens
  setTimeout(() => {
    window.print();
    // Remove injected spans after print dialog closes
    injected.forEach(s => { if(s.parentNode) s.parentNode.removeChild(s); });
  }, 80);
}

/* ─── SECTION 6: PAYMENT MODE TOTAL ─── */
function calcPmtTotal(){
  const keys=['pmt_cash_amount','pmt_cheque','pmt_online_payment','pmt_bank_dd','pmt_po','pmt_trade_value','pmt_refund'];
  const pmtTotal=keys.reduce((sum,k)=>sum+(parseFloat(FD[k]||0)||0),0);
  const el=document.getElementById('pmt-total-received');
  if(el) el.textContent='₹'+pmtTotal.toFixed(2);
  // Grand Total Received = Grand Total Payable − Total Amount Received
  const grand=FD._grandTotal||0;
  const grandRec=grand-pmtTotal;
  const status=grandRec>0?'Excess Amount':grandRec<0?'Short Amount':'Balanced';
  setEl('calc-grand-rec-label',status);
  setEl('calc-grand-rec','₹'+grandRec.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}));
}

/* ─── INIT ───────────────────────────── */
renderChips('vas');renderLineRows('vas');
renderChips('oem');renderLineRows('oem');
calcAll();
calcPmtTotal();
