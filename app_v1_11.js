// ==== 画面切替 ====
function showView(which){
  document.getElementById('homeView').style.display = (which==='home')?'block':'none';
  document.getElementById('productView').style.display = (which==='product')?'block':'none';
  document.getElementById('docView').style.display = (which==='doc')?'block':'none';
  document.getElementById('customerView').style.display = (which==='customer')?'block':'none';
  if(which==='product'){ ensureMasterLoaded_ps(); }
  if(which==='doc'){ ensureMasterLoaded(); initDocDefaults(); }
  if(which==='customer'){ renderCustomerListFull(); }
}
window.addEventListener('load', ()=>{ showView('home'); });

// ==== 固定会社情報 ====
const COMPANY = {
  name: 'フルハウス児玉',
  zip: '649-6433',
  address: '和歌山県紀の川市藤井916',
  regno: 'T1234567890123',
  tel_company: '090-1234-5678',
  staff_label: '担当',
  staff_default: '児玉 征紀'
};

// ==== ユーティリティ ====
function escapeHtml(s){
  s = (s === undefined || s === null) ? '' : String(s);
  return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function todayStr(){ return new Date().toISOString().split('T')[0]; }
function initDocDefaults(){
  if(!document.getElementById('docDate').value) document.getElementById('docDate').value = todayStr();
  if(!document.getElementById('staff').value) document.getElementById('staff').value = COMPANY.staff_default;
}
const yen = v => isNaN(Number(v)) ? '-' : Number(v).toLocaleString('ja-JP',{style:'currency',currency:'JPY'});

function kataToHira(str){ return String(str||'').replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)); }
function normalizeJP(str){
  return String(str||'')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g,'')
    .replace(/[‐－―ー\-—−]/g,'')
    .replace(/[\/.,、。]/g,'');
}
function buildSearchKey(rec){
  const joined = [rec.client, rec.address, rec.tel, rec.note].map(v=>String(v||'')).join(' ');
  const norm = normalizeJP(joined);
  const hira = normalizeJP(kataToHira(joined));
  return norm + ' ' + hira;
}

// ==== 郵便番号：自動ハイフン & 住所検索 ====
function formatZipLive(el){
  const v = (el.value||'').replace(/\D/g,'').slice(0,7);
  el.value = (v.length>3) ? (v.slice(0,3)+'-'+v.slice(3)) : v;
}
function lookupZipTo(zipInputId, addressInputId){
  const zipRaw = document.getElementById(zipInputId).value || '';
  const zip = zipRaw.replace(/[^0-9]/g,'');
  if(zip.length < 7) return;
  fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`)
    .then(r=>r.json()).then(d=>{
      if(d.results && d.results[0]){
        const r = d.results[0];
        document.getElementById(addressInputId).value = `${r.address1}${r.address2}${r.address3}`;
      }
    }).catch(()=>{});
}

// ==== 商品マスタ（doc 用）====
let master = [], filtered = [];
const MASTER_KEY = 'product_master_cache_v19';
function ensureMasterLoaded(){
  const saved = localStorage.getItem(MASTER_KEY);
  if(saved && master.length===0){
    try{
      master = JSON.parse(saved).map(r=>({ ...r, _key: normalizeJP(String((r.name||'')+' '+(r.code||''))) }));
      filtered = master.slice();
      renderMaster();
    }catch(e){}
  }
}
function clearMasterCache(){
  localStorage.removeItem(MASTER_KEY);
  master = []; filtered = [];
  renderMaster();
  alert('商品マスタをクリアしました。新しいCSV/Excelを読み込んでください。');
}
function loadMasterFile(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const data = ev.target.result;
    const wb = XLSX.read(data, {type:'binary'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws,{defval:""});
    master = json.map(r=>({ ...r, _key: normalizeJP(String((r.name||'')+' '+(r.code||''))) }));
    filtered = master.slice();
    renderMaster();
    localStorage.setItem(MASTER_KEY, JSON.stringify(master.map(({_key,...rest})=>rest)));
    alert(`商品マスタを読込みました：${master.length}件`);
  };
  reader.readAsBinaryString(file);
}
function renderMaster(){
  const box = document.getElementById('masterList'); if(!box) return;
  box.innerHTML = '';
  filtered.forEach((r,i)=>{
    const div = document.createElement('div'); 
    div.className='item';
    // クリックで追加（ボタンは廃止）
    div.setAttribute('role','button');
    div.setAttribute('tabindex','0');
    div.style.cursor = 'pointer';
    div.onclick = ()=> addFromMaster(i);
    div.onkeypress = (e)=>{ if(e.key==='Enter' || e.key===' ') addFromMaster(i); };

    const imgSrc = r.image? String(r.image) : '';
    const priceView = isFinite(r.price)? Number(r.price).toLocaleString('ja-JP',{style:'currency',currency:'JPY'}) : '-';
    div.innerHTML = `
      <img src="${escapeHtml(imgSrc)}" alt="" onerror="this.style.visibility='hidden'">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:600">${escapeHtml(r.name||'')}</div>
        </div>
        <div class="kmeta">${escapeHtml(r.code||'')}</div>
        <div class="price">${priceView}</div>
      </div>`;
    box.appendChild(div);
  });
  const cnt = document.getElementById('masterCount'); if(cnt) cnt.textContent = `${filtered.length}件`;
}
function searchMaster(){
  const qRaw = document.getElementById('searchBox').value||'';
  const q = normalizeJP(qRaw);
  const tokens = q.split(/\s+/).filter(Boolean);
  filtered = tokens.length===0 ? master.slice() : master.filter(r => tokens.every(t => String(r._key).includes(t)));
  renderMaster();
}
function addFromMaster(idx){
  const item = filtered[idx] || {};
  const type = document.getElementById('docType').value;
  const unit = (type==='発注書') ? (item.cost||'') : (item.price||'');
  addRow({name:item.name||'', code:item.code||'', unit:unit});
}

// ==== 商品マスタ（productView：閲覧のみ）====
let master_ps = [], filtered_ps = [];
function ensureMasterLoaded_ps(){
  const saved = localStorage.getItem(MASTER_KEY);
  if(saved && master_ps.length===0){
    try{
      master_ps = JSON.parse(saved).map(r=>({ ...r, _key: normalizeJP(String((r.name||'')+' '+(r.code||''))) }));
      filtered_ps = master_ps.slice();
      renderMaster_ps();
    }catch(e){}
  }
}
function clearMasterCache_ps(){
  localStorage.removeItem(MASTER_KEY);
  master_ps = []; filtered_ps = [];
  renderMaster_ps();
  alert('商品マスタ（閲覧用）をクリアしました。');
}
function loadMasterFile_ps(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const data = ev.target.result;
    const wb = XLSX.read(data, {type:'binary'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws,{defval:""});
    master_ps = json.map(r=>({ ...r, _key: normalizeJP(String((r.name||'')+' '+(r.code||''))) }));
    filtered_ps = master_ps.slice();
    renderMaster_ps();
    localStorage.setItem(MASTER_KEY, JSON.stringify(master_ps.map(({_key,...rest})=>rest)));
    alert(`商品マスタを読込みました：${master_ps.length}件`);
  };
  reader.readAsBinaryString(file);
}
function renderMaster_ps(){
  const box = document.getElementById('masterList_ps'); if(!box) return;
  box.innerHTML = '';
  filtered_ps.forEach((r)=>{
    const div = document.createElement('div'); div.className='item';
    const imgSrc = r.image? String(r.image) : '';
    const priceView = isFinite(r.price)? Number(r.price).toLocaleString('ja-JP',{style:'currency',currency:'JPY'}) : '-';
    div.innerHTML = `
      <img src="${escapeHtml(imgSrc)}" alt="" onerror="this.style.visibility='hidden'">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:600">${escapeHtml(r.name||'')}</div>
        </div>
        <div class="kmeta">${escapeHtml(r.code||'')}</div>
        <div class="price">${priceView}</div>
      </div>`;
    box.appendChild(div);
  });
  const cnt = document.getElementById('masterCount_ps'); if(cnt) cnt.textContent = `${filtered_ps.length}件`;
}
function searchMaster_ps(){
  const qRaw = document.getElementById('searchBox_ps').value||'';
  const q = normalizeJP(qRaw);
  const tokens = q.split(/\s+/).filter(Boolean);
  filtered_ps = tokens.length===0 ? master_ps.slice() : master_ps.filter(r => tokens.every(t => String(r._key).includes(t)));
  renderMaster_ps();
}

// ==== 顧客（保存・Excel I/O・フォーム編集）====
const CUSTOMER_KEY = 'customer_list_v111'; // v1.11

function loadCustomers(){ 
  // 旧キーからの移行（v110 → v111）
  const old = localStorage.getItem('customer_list_v110');
  if(old && !localStorage.getItem(CUSTOMER_KEY)){
    try{
      const arr = JSON.parse(old);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(arr));
      localStorage.removeItem('customer_list_v110');
    }catch(e){}
  }
  try{ return JSON.parse(localStorage.getItem(CUSTOMER_KEY)||'[]'); }catch(e){ return []; } 
}
function saveCustomers(list){ localStorage.setItem(CUSTOMER_KEY, JSON.stringify(list)); }

// 書類側から登録（備考は空で登録）
function getFormCustomer(){
  return {
    client: document.getElementById('client').value.trim(),
    zip: document.getElementById('zip').value.trim(),
    address: document.getElementById('address').value.trim(),
    tel: document.getElementById('tel').value.trim(),
    note: ''
  };
}
function registerCustomer(){
  const c = getFormCustomer();
  if(!c.client){ alert('宛名が空です'); return; }
  const list = loadCustomers();
  const idx = list.findIndex(x => (x.client||'')===c.client);
  if(idx>=0){
    if(!confirm('同じ宛名が存在します。上書きしますか？')) return;
    c.note = list[idx].note || '';
    list[idx] = c;
  }else{
    list.push(c);
  }
  saveCustomers(list);
  alert('顧客を登録しました');
}

// 書類側モーダル（選択専用）
function setFormCustomerIndex(i){
  const c = loadCustomers()[i]; if(!c) return;
  document.getElementById('client').value = c.client||'';
  document.getElementById('zip').value    = c.zip||'';
  document.getElementById('address').value= c.address||'';
  document.getElementById('tel').value    = c.tel||'';
}
function openCustomerModal(){
  document.getElementById('customerModal').style.display='flex';
  renderCustomerList();
  const s = document.getElementById('customerSearch'); if(s){ s.value=''; s.focus(); }
}
function closeCustomerModal(){ document.getElementById('customerModal').style.display='none'; }
function renderCustomerList(){
  const q = (document.getElementById('customerSearch').value||'').toLowerCase();
  const list = loadCustomers().filter(c =>
    ((c.client||'')+' '+(c.address||'')+' '+(c.tel||'')+' '+(c.zip||'')+' '+(c.note||'')).toLowerCase().includes(q)
  );
  const wrap = document.getElementById('customerList'); wrap.innerHTML='';
  if(list.length===0){ wrap.innerHTML='<div class="kmeta">（登録がありません）</div>'; return; }
  list.forEach((c,i)=>{
    const row = document.createElement('div');
    row.className='item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(c.client||'')}</div>
        <div class="kmeta">〒${escapeHtml(c.zip||'')}　${escapeHtml(c.address||'')}</div>
        <div class="kmeta">TEL：${escapeHtml(c.tel||'')}</div>
        <div class="note">備考：${escapeHtml(c.note||'')}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:start">
        <button class="primary" onclick="setFormCustomerIndex(${i}); closeCustomerModal()">呼び出す</button>
      </div>`;
    wrap.appendChild(row);
  });
}
document.addEventListener('input', (e)=>{ if(e.target && e.target.id==='customerSearch') renderCustomerList(); });

// 顧客フルビュー + フォーム編集
let editingIndexFull = -1; // -1: 新規
function showCustomerFormFull(c){
  document.getElementById('customerForm_full').style.display = 'block';
  document.getElementById('customerList_full').style.display = 'none';
  document.getElementById('cf_client').value  = c?.client  || '';
  document.getElementById('cf_zip').value     = c?.zip     || '';
  document.getElementById('cf_address').value = c?.address || '';
  document.getElementById('cf_tel').value     = c?.tel     || '';
  document.getElementById('cf_note').value    = c?.note    || '';
}
function hideCustomerFormFull(){
  document.getElementById('customerForm_full').style.display = 'none';
  document.getElementById('customerList_full').style.display = 'block';
}
function addNewCustomer(){
  editingIndexFull = -1;
  showCustomerFormFull(null);
}
function editCustomerFull(i){
  const list = loadCustomers();
  const c = list[i]; if(!c) return;
  editingIndexFull = i;
  showCustomerFormFull(c);
}
function saveCustomerFull(){
  const client  = document.getElementById('cf_client').value.trim();
  const zip     = document.getElementById('cf_zip').value.trim();
  const address = document.getElementById('cf_address').value.trim();
  const tel     = document.getElementById('cf_tel').value.trim();
  const note    = document.getElementById('cf_note').value;

  if(!client){ alert('宛名は必須です'); return; }

  const list = loadCustomers();
  const rec = {client, zip, address, tel, note};

  if(editingIndexFull >= 0){
    const dup = list.findIndex((x,idx)=> idx!==editingIndexFull && (x.client||'')===client);
    if(dup >= 0 && !confirm('同じ宛名が存在します。上書きしますか？')) return;
    list[editingIndexFull] = rec;
  }else{
    const idx = list.findIndex(x=> (x.client||'')===client);
    if(idx >= 0){
      if(!confirm('同じ宛名が存在します。上書きしますか？')) return;
      list[idx] = rec;
    }else{
      list.push(rec);
    }
  }

  saveCustomers(list);
  hideCustomerFormFull();
  renderCustomerListFull();
  alert('保存しました');
}
function cancelCustomerFull(){
  hideCustomerFormFull();
}
function deleteCustomerFull(i){
  if(!confirm('削除しますか？')) return;
  const list = loadCustomers(); list.splice(i,1); saveCustomers(list); renderCustomerListFull();
}
function renderCustomerListFull(){
  const q = (document.getElementById('customerSearch_full').value||'').toLowerCase();
  const list = loadCustomers().filter(c =>
    ((c.client||'')+' '+(c.address||'')+' '+(c.tel||'')+' '+(c.zip||'')+' '+(c.note||'')).toLowerCase().includes(q)
  );
  const box = document.getElementById('customerList_full'); if(!box) return;
  box.innerHTML='';
  if(list.length===0){ box.innerHTML='<div class="kmeta">（登録がありません）</div>'; }
  list.forEach((c,i)=>{
    const row = document.createElement('div'); row.className='item';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(c.client||'')}</div>
        <div class="kmeta">〒${escapeHtml(c.zip||'')}　${escapeHtml(c.address||'')}　TEL：${escapeHtml(c.tel||'')}</div>
        <div class="note">備考：${escapeHtml(c.note||'')}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="editCustomerFull(${i})">編集</button>
        <button onclick="deleteCustomerFull(${i})">削除</button>
      </div>`;
    box.appendChild(row);
  });
  const cnt = document.getElementById('customerCount'); if(cnt) cnt.textContent = `${list.length}件`;
}

// Excel I/O（備考含む）
function exportCustomersExcel(){
  const list = loadCustomers();
  const ws = XLSX.utils.json_to_sheet(list.length? list : [{client:'',zip:'',address:'',tel:'',note:''}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "customers");
  XLSX.writeFile(wb, "customers.xlsx");
}
function downloadCustomerSample(){
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["client","zip","address","tel","note"],
    ["〇〇株式会社 御中","649-6433","和歌山県紀の川市…","0736-**-****","納品先が本社と異なる"],
    ["山田 太郎 様","***-****","東京都〇〇区…","090-****-****","訪問希望：午後"]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "customers");
  XLSX.writeFile(wb, "customers_sample.xlsx");
}
function importCustomersFile(e, fromFull=false){
  const input = e.target;
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const wb = XLSX.read(ev.target.result, {type:'binary'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json(ws,{defval:""});
    rows = rows.map(r=>{
      const o = {};
      for(const k in r){
        const key = String(k).trim().toLowerCase();
        if(/^(client|宛名|得意先|顧客名)$/.test(key)) o.client = r[k];
        else if(/^(zip|郵便番号|〒)$/.test(key)) o.zip = r[k];
        else if(/^(address|住所)$/.test(key)) o.address = r[k];
        else if(/^(tel|電話|電話番号)$/.test(key)) o.tel = r[k];
        else if(/^(note|notes|備考)$/.test(key)) o.note = r[k];
      }
      return {client:o.client||'', zip:o.zip||'', address:o.address||'', tel:o.tel||'', note:o.note||''};
    }).filter(x=> (x.client||x.address||x.tel||x.zip||x.note));
    if(rows.length===0){ alert('有効な顧客データが見つかりませんでした'); return; }
    const replace = confirm('OK=既存リストを置き換え／キャンセル=追加入（同名は上書き）');
    if(replace){ saveCustomers(rows); }
    else{
      const current = loadCustomers();
      const map = new Map(current.map(c=>[c.client||'', c]));
      rows.forEach(r=>{ map.set(r.client||'', r); });
      saveCustomers(Array.from(map.values()).filter(c=>c.client));
    }
    alert(`顧客データを${replace?'置き換え':'追加入'}しました（${rows.length}件）`);
    if(fromFull){ renderCustomerListFull(); } else { renderCustomerList(); }
    input.value = "";
  };
  reader.readAsBinaryString(file);
}

// ==== 明細行 ====
function addRow(item={}){
  const tbody=document.querySelector('#itemTable tbody');
  const tr=document.createElement('tr');
  const i=tbody.children.length+1;
  tr.innerHTML=`
    <td>${i}</td>
    <td contenteditable>${escapeHtml(item.name||'')}</td>
    <td contenteditable>${escapeHtml(item.code||'')}</td>
    <td contenteditable>1</td>
    <td contenteditable>${escapeHtml(item.unit||'')}</td>
    <td>0</td>`;
  tbody.appendChild(tr);
  calcTable();
}
document.querySelector('#itemTable tbody').addEventListener('input', calcTable);
function calcTable(){
  document.querySelectorAll('#itemTable tbody tr').forEach(tr=>{
    const qty=parseFloat(tr.children[3].innerText.replace(/,/g,''))||0;
    const unit=parseFloat(tr.children[4].innerText.replace(/,/g,''))||0;
    tr.children[5].innerText=(qty*unit).toLocaleString('ja-JP');
  });
}
function onDocTypeChange(){
  const type=document.getElementById('docType').value;
  document.getElementById('unitHead').innerText = (type==='発注書')?'原価':'単価';
}

// ==== PDF/印刷 ====
function openPrint(){
  const type=document.getElementById('docType').value;
  const no=document.getElementById('docNo').value;
  const date=document.getElementById('docDate').value||todayStr();
  const staff=document.getElementById('staff').value||COMPANY.staff_default;
  const zip=document.getElementById('zip').value;
  const addr=document.getElementById('address').value;
  const tel=document.getElementById('tel').value;
  const client=document.getElementById('client').value;
  const notes=document.getElementById('notes').value;

  const rows=[...document.querySelectorAll('#itemTable tbody tr')].map(tr=>({
    name:tr.children[1].innerText,
    code:tr.children[2].innerText,
    qty:tr.children[3].innerText,
    unit:tr.children[4].innerText,
    sum:tr.children[5].innerText
  }));
  const total = rows.reduce((a,b)=>a+(parseFloat((b.sum||'').replace(/,/g,''))||0),0).toLocaleString('ja-JP');

  const area=document.getElementById('printArea');
  const unitLabel = (type==='発注書')?'原価':'単価';
  area.innerHTML=`
  <section class="doc-wrap">
    <div class="doc-header" style="padding:4px 16px 0 16px">
      <div style="margin-left:auto;text-align:right;font-size:12px;line-height:1.6">
        <b style="font-size:14px">${escapeHtml(type)}</b><br>
        No.${escapeHtml(no||'')}　発行日：${escapeHtml(date)}　${escapeHtml(COMPANY.staff_label)}：${escapeHtml(staff)}
      </div>
    </div>
    <div style="display:flex;gap:16px;padding:0 16px 8px 16px">
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px">
        <strong>宛先</strong><br>
        ${escapeHtml(client||'')}<br>
        〒${escapeHtml(zip||'')} ${escapeHtml(addr||'')}<br>
        TEL：${escapeHtml(tel||'')}
      </div>
      <div style="flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px">
        <strong>発行元</strong><br>
        ${escapeHtml(COMPANY.name)}<br>
        〒649-6433<br>
        ${escapeHtml(COMPANY.address)}<br>
        登録番号：${escapeHtml(COMPANY.regno)}<br>
        TEL：${escapeHtml(COMPANY.tel_company)}
      </div>
    </div>
    <table class="doc-table" style="width:calc(100% - 32px);margin:8px 16px;border-collapse:collapse">
      <thead><tr><th>#</th><th>商品名</th><th>品番</th><th>数量</th><th>${unitLabel}</th><th>小計</th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.code)}</td><td style="text-align:right">${escapeHtml(r.qty)}</td><td style="text-align:right">${escapeHtml(r.unit)}</td><td style="text-align:right">${escapeHtml(r.sum)}</td></tr>`).join('')}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;padding:0 16px 12px"><div style="border:2px solid #165b4a;border-radius:8px;padding:10px 14px;font-size:18px;font-weight:800;color:#165b4a;background:#fff">合計金額 ${total} 円</div></div>
    <div style="display:grid;grid-template-columns:1fr 280px;gap:10px;margin:12px 16px 16px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;background:#fcfcfc">備考：${escapeHtml(notes||'')}</div>
      <div></div>
    </div>
  </section>`;
  area.scrollIntoView({behavior:'smooth'});
  window.print();
}

// ==== Excel出力（明細） ====
function exportExcel(){
  const wb = XLSX.utils.book_new();
  const ws_data = [["#","商品名","品番","数量", document.getElementById('unitHead').innerText,"小計"]];
  document.querySelectorAll('#itemTable tbody tr').forEach((tr)=>{
    const row=[...tr.children].slice(0,6).map(td=>td.innerText);
    ws_data.push(row);
  });
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "sheet1");
  const type=document.getElementById('docType').value||'doc';
  const name=(document.getElementById('docNo').value||'nonum');
  XLSX.writeFile(wb, `${type}_${name}.xls`);
}

// ==== ドキュメント保存/読込 ====
function saveLocal(){
  const data = {
    docType:document.getElementById('docType').value,
    docNo:document.getElementById('docNo').value,
    docDate:document.getElementById('docDate').value,
    staff:document.getElementById('staff').value,
    zip:document.getElementById('zip').value,
    address:document.getElementById('address').value,
    tel:document.getElementById('tel').value,
    client:document.getElementById('client').value,
    notes:document.getElementById('notes').value,
    rows:[...document.querySelectorAll('#itemTable tbody tr')].map(tr=>
      [...tr.children].slice(1,6).map(td=>td.innerText))
  };
  localStorage.setItem('fullhouse_doc_v111', JSON.stringify(data));
  alert('保存しました');
}
function loadLocal(){
  const raw = localStorage.getItem('fullhouse_doc_v111'); if(!raw){ alert('保存データがありません'); return; }
  const d = JSON.parse(raw);
  ['docType','docNo','docDate','staff','zip','address','tel','client','notes'].forEach(id=>{
    if(d[id]!==undefined) document.getElementById(id).value=d[id];
  });
  const tbody=document.querySelector('#itemTable tbody'); tbody.innerHTML='';
  (d.rows||[]).forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${tbody.children.length+1}</td>
      <td contenteditable>${escapeHtml(r[0]||'')}</td>
      <td contenteditable>${escapeHtml(r[1]||'')}</td>
      <td contenteditable>${escapeHtml(r[2]||'')}</td>
      <td contenteditable>${escapeHtml(r[3]||'')}</td>
      <td>${escapeHtml(r[4]||'')}</td>`;
    tbody.appendChild(tr);
  });
  onDocTypeChange();
  calcTable();
}

// ==== アコーディオン ====
function toggleDoc(){
  const body = document.getElementById('docBody');
  const icon = document.getElementById('toggleIcon');
  const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
  if(isOpen){
    body.style.maxHeight = '0px';
    icon.textContent = '▶';
  }else{
    body.style.maxHeight = body.scrollHeight + 'px';
    icon.textContent = '▼';
  }
}
window.addEventListener('load', ()=>{
  const body = document.getElementById('docBody');
  if(body){ body.style.maxHeight = body.scrollHeight + 'px'; }
});

// ==== サンプルCSV（商品） ====
function downloadSample(){
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name","code","cost","price","supplier","image"],
    ["サンプル商品A","AAA-001",5000,10000,"仕入先A",""],
    ["サンプル商品B","BBB-002",9000,50000,"仕入先B",""],
    ["サンプル商品C","CCC-003",8000,10000,"仕入先C",""]
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "sample");
  XLSX.writeFile(wb, "product_master_sample_v19.xlsx");
}
