const CONFIG={geoUrl:"https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json",boundaryUrl:"https://raw.githubusercontent.com/meetshaks/bangladesh-administrative-boundaries-json/main/bgd_admin1.geojson",supabaseUrl:"",supabaseAnonKey:"",cloudinaryCloudName:"",cloudinaryUploadPreset:""};

const $=s=>document.querySelector(s); const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
let BD=[]; let current=null;

const missions=[
 {icon:"🏛️",title:"Heritage Hunt",text:"নিজের এলাকার বাস্তব ঐতিহাসিক/স্থাপত্য spot-এর ছবি তুলুন।",xp:200},
 {icon:"🌿",title:"Nature Hunt",text:"নদী, বিল, হাওর, বন বা গ্রামের প্রকৃতির একটি original shot।",xp:150},
 {icon:"📍",title:"Local Landmark",text:"আপনার ইউনিয়ন/ওয়ার্ডের পরিচিত landmark capture করুন।",xp:100}
];
$("#missionGrid").innerHTML=missions.map(m=>`<article class="mission"><div class="icon">${m.icon}</div><h3>${m.title}</h3><p>${m.text}</p><div class="xp">+${m.xp} XP</div><button class="btn secondary" style="margin-top:15px" onclick="requireLogin()">Mission খুলুন →</button></article>`).join("");

function requireLogin(){if(!CONFIG.supabaseUrl) alert("এই build-এ Supabase keys এখনো বসানো হয়নি। .env.example অনুযায়ী keys বসালে real login, upload ও leaderboard চালু হবে।"); else $("#authModal").classList.remove("hidden")}

async function loadData(){
 try{
  const r=await fetch(CONFIG.geoUrl); if(!r.ok) throw new Error("geo data failed"); BD=await r.json();
  let districts=0,upazilas=0,unions=0;
  BD.forEach(d=>{districts+=d.districts?.length||0;d.districts?.forEach(x=>{upazilas+=x.upazilas?.length||0;x.upazilas?.forEach(u=>unions+=u.unions?.length||0)})});
  $("#divisionCount").textContent=BD.length;$("#districtCount").textContent=districts;$("#upazilaCount").textContent=upazilas;$("#unionCount").textContent=unions;
  $("#dataStatus").textContent=`${BD.length} বিভাগ • ${districts} জেলা`;
  renderTree();
 }catch(e){$("#dataStatus").textContent="Data unavailable";$("#tree").innerHTML='<div class="empty small">Location data load হয়নি। Internet connection/check CONFIG.geoUrl.</div>'}
}
function renderTree(list=BD){
 $("#tree").innerHTML=list.map((d,i)=>`<div class="tree-item" onclick="showDivision(${i})"><strong>🇧🇩 ${esc(d.bn_name||d.name)}</strong><small>${d.districts?.length||0} জেলা</small></div>`).join("");
}
window.showDivision=i=>{const d=BD[i];current=d;$("#crumb").textContent=d.bn_name||d.name;$("#tree").innerHTML=d.districts.map((x,j)=>`<div class="tree-item" onclick="showDistrict(${i},${j})"><strong>${esc(x.bn_name||x.name)}</strong><small>${x.upazilas?.length||0} উপজেলা</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(d.bn_name||d.name)}</h3><p style="color:var(--muted)">এই বিভাগের জেলা নির্বাচন করুন।</p><div class="chips">${d.districts.map(x=>`<span class="chip">${esc(x.bn_name||x.name)}</span>`).join("")}</div>`};
window.showDistrict=(di,xi)=>{const d=BD[di],x=d.districts[xi];$("#crumb").textContent=`${d.bn_name||d.name} / ${x.bn_name||x.name}`;$("#tree").innerHTML=x.upazilas.map((u,j)=>`<div class="tree-item" onclick="showUpazila(${di},${xi},${j})"><strong>${esc(u.bn_name||u.name)}</strong><small>${u.unions?.length||0} ইউনিয়ন</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(x.bn_name||x.name)}</h3><p style="color:var(--muted)">উপজেলা বাছাই করুন।</p>`};
window.showUpazila=(di,xi,ui)=>{const u=BD[di].districts[xi].upazilas[ui];$("#crumb").textContent=`${BD[di].bn_name} / ${BD[di].districts[xi].bn_name} / ${u.bn_name||u.name}`;$("#tree").innerHTML=(u.unions||[]).map((n,j)=>`<div class="tree-item"><strong>${esc(n.bn_name||n.name)}</strong><small>ইউনিয়ন</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(u.bn_name||u.name)}</h3><p style="color:var(--muted)">এই build-এ union পর্যন্ত machine-readable hierarchy আছে।</p><div class="chips">${(u.unions||[]).map(n=>`<span class="chip">${esc(n.bn_name||n.name)}</span>`).join("")}</div><div class="mission" style="margin-top:20px"><b>গ্রাম / মৌজা layer</b><p>গ্রাম ও মৌজা আলাদা cadastral/geographic layer। ভুল নাম বানিয়ে না দিয়ে verified BBS/DLRS import layer হিসেবে রাখা হয়েছে।</p></div>`};

$("#searchBtn").onclick=()=>{const q=$("#searchBox").value.trim().toLowerCase();if(!q)return renderTree();const out=[];BD.forEach((d,di)=>{if((d.bn_name||d.name).toLowerCase().includes(q))out.push({label:d.bn_name||d.name,sub:"বিভাগ",fn:`showDivision(${di})`});d.districts?.forEach((x,xi)=>{if((x.bn_name||x.name).toLowerCase().includes(q))out.push({label:x.bn_name||x.name,sub:`জেলা • ${d.bn_name}`,fn:`showDistrict(${di},${xi})`});x.upazilas?.forEach((u,ui)=>{if((u.bn_name||u.name).toLowerCase().includes(q))out.push({label:u.bn_name||u.name,sub:`উপজেলা • ${x.bn_name}`,fn:`showUpazila(${di},${xi},${ui})`})})})});$("#tree").innerHTML=out.slice(0,100).map(o=>`<div class="tree-item" onclick="${o.fn}"><strong>${esc(o.label)}</strong><small>${esc(o.sub)}</small></div>`).join("")||'<div class="empty small">কিছু পাওয়া যায়নি।</div>'};

async function initMap(){const map=L.map("map",{zoomControl:false,scrollWheelZoom:false}).setView([23.685,90.3563],7);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);try{const r=await fetch(CONFIG.boundaryUrl);const gj=await r.json();L.geoJSON(gj,{style:{color:"#20d46b",weight:1,fillColor:"#0f5a37",fillOpacity:.35},onEachFeature:(f,l)=>l.bindTooltip(f.properties?.shapeName||"Bangladesh",{sticky:true})}).addTo(map)}catch(e){}}
$("#authBtn").onclick=()=>$("#authModal").classList.remove("hidden");document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>$("#authModal").classList.add("hidden"));$("#nearbyBtn").onclick=()=>{if(!navigator.geolocation)return alert("Browser GPS unavailable");navigator.geolocation.getCurrentPosition(()=>alert("GPS পাওয়া গেছে। Real mission matching চালু হবে backend/API keys বসানোর পর।"),()=>alert("GPS permission দিন।"))};

loadData();initMap();
