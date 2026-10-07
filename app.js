import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIG = {
  geoUrl: "https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json",
  boundaryUrl: "https://raw.githubusercontent.com/meetshaks/bangladesh-administrative-boundaries-json/main/bgd_admin1.geojson",
  supabaseUrl: "",
  supabaseKey: "",
  cloudinaryCloudName: "",
  cloudinaryUploadPreset: ""
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));

let BD = [];
let supabase = null;
let currentUser = null;
let currentProfile = null;
let authMode = "login";
let selectedExplore = { division:"", district:"", upazila:"", union_name:"", village:"", mouza:"" };

const fallbackMissions = [
  { icon:"🏛️", title:"Heritage Hunt", description:"আপনার এলাকার একটি বাস্তব heritage/স্থাপত্য spot explore করুন।", xp:100 },
  { icon:"🌿", title:"Nature Hunt", description:"নদী, বিল, হাওর, বন বা গ্রামের প্রকৃতির original photo তুলুন।", xp:100 },
  { icon:"📍", title:"Local Landmark", description:"আপনার পরিচিত landmark বা local place capture করুন।", xp:100 }
];

async function loadConfig(){
  try{
    const r=await fetch("/api/config",{cache:"no-store"});
    const d=await r.json();
    CONFIG.supabaseUrl=d.supabaseUrl||"";
    CONFIG.supabaseKey=d.supabasePublishableKey||"";
    CONFIG.cloudinaryCloudName=d.cloudinaryCloudName||"";
    CONFIG.cloudinaryUploadPreset=d.cloudinaryUploadPreset||"";
    if(CONFIG.supabaseUrl&&CONFIG.supabaseKey){
      supabase=createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey);
      await initAuth();
    }
  }catch(e){console.error(e);}
}

async function initAuth(){
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user) await handleUser(session.user);
  supabase.auth.onAuthStateChange(async(_event,session)=>{
    if(session?.user) await handleUser(session.user);
    else { currentUser=null; currentProfile=null; updateAuthButton(); renderLeaderboard(); }
  });
}

async function handleUser(user){
  currentUser=user;
  await ensureProfile(user);
  await loadProfile();
  updateAuthButton();
  await renderLeaderboard();
}

async function ensureProfile(user){
  const {data}=await supabase.from("profiles").select("id").eq("id",user.id).maybeSingle();
  if(!data){
    const base=(user.email||"explorer").split("@")[0].replace(/[^a-zA-Z0-9_]/g,"").slice(0,22)||"explorer";
    const username=`${base}_${user.id.slice(0,5)}`;
    await supabase.from("profiles").insert({id:user.id,username});
  }
}

async function loadProfile(){
  if(!currentUser)return;
  const {data}=await supabase.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();
  if(data) currentProfile=data;
}

function updateAuthButton(){
  const b=$("#authBtn"); if(!b)return;
  if(currentUser){
    b.textContent=`👤 ${currentProfile?.username||"Explorer"}`;
    b.onclick=openAccountModal;
  }else{
    b.textContent="Login"; b.onclick=openAuthModal;
  }
}

function openAuthModal(){ $("#authModal")?.classList.remove("hidden"); setAuthMode("login"); }
function setAuthMode(mode){
  authMode=mode;
  $("#authTitle").textContent=mode==="login"?"Login":"Create Explorer Account";
  $("#submitAuth").textContent=mode==="login"?"Login":"Create account";
  $("#toggleAuth").textContent=mode==="login"?"Create account":"Already have an account? Login";
  $("#authMsg").textContent="";
}
async function submitAuth(){
  if(!supabase){showAuthMessage("Supabase connection পাওয়া যায়নি। Render Environment Variables check করুন।",true);return;}
  const email=$("#email")?.value.trim(), password=$("#password")?.value;
  if(!email||!password){showAuthMessage("Email এবং password দিন।",true);return;}
  $("#submitAuth").disabled=true;
  try{
    const result=authMode==="login"
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password});
    if(result.error)throw result.error;
    showAuthMessage(authMode==="login"?"Login successful ✅":"Account তৈরি হয়েছে। Email verification লাগলে verify করুন।",false);
    if(authMode==="login")setTimeout(()=>$("#authModal")?.classList.add("hidden"),500);
  }catch(e){showAuthMessage(e.message||"Authentication failed",true)}
  finally{$("#submitAuth").disabled=false;}
}
function showAuthMessage(m,error){const e=$("#authMsg");if(e){e.textContent=m;e.style.color=error?"#ff6b6b":"#20d46b";}}
async function logout(){await supabase?.auth.signOut();}

function openAccountModal(){
  const p=currentProfile||{};
  const html=`<div class="modal" id="accountModal"><div class="modal-card wide"><button class="x" id="closeAccount">×</button><div class="profile-head"><div class="avatar">🇧🇩</div><div><h2>${esc(p.username||"Explorer")}</h2><small>${esc(currentUser?.email||"")}</small></div></div><div class="profile-stats"><div><b>${p.total_explores||0}</b><span>Places explored</span></div><div><b>${p.districts_explored||0}</b><span>Districts</span></div><div><b>${p.upazilas_explored||0}</b><span>Upazilas</span></div><div><b>${p.unions_explored||0}</b><span>Unions</span></div></div><p class="sub">আপনার approved photo ও verified location-গুলোই Explorer count-এ যোগ হয়।</p><button class="btn primary full" id="profileExploreBtn">📸 New Explore</button><button class="btn secondary full" id="logoutBtn">Logout</button></div></div>`;
  document.body.insertAdjacentHTML("beforeend",html);
  $("#closeAccount").onclick=()=>$("#accountModal")?.remove();
  $("#logoutBtn").onclick=async()=>{await logout();$("#accountModal")?.remove();};
  $("#profileExploreBtn").onclick=()=>{ $("#accountModal")?.remove(); openExploreModal(); };
}

function openExploreModal(){
  if(!currentUser){openAuthModal();return;}
  const html=`<div class="modal" id="exploreModal"><div class="modal-card wide"><button class="x" id="closeExplore">×</button><div class="modal-icon">📸</div><h2>Explore a Bangladesh Location</h2><p>Location নির্বাচন করুন, GPS verify করুন, তারপর photo upload করুন। Approval-এর পর জায়গাটি আপনার Explorer profile-এ count হবে।</p><div class="select-grid"><select id="exDivision"><option value="">বিভাগ নির্বাচন</option></select><select id="exDistrict"><option value="">জেলা নির্বাচন</option></select><select id="exUpazila"><option value="">উপজেলা নির্বাচন</option></select><select id="exUnion"><option value="">ইউনিয়ন নির্বাচন</option></select></div><input id="exVillage" placeholder="গ্রাম / Locality (optional)"><input id="exMouza" placeholder="মৌজা (optional)"><textarea id="exCaption" placeholder="এই জায়গা সম্পর্কে ছোট caption লিখুন…"></textarea><input id="exPhoto" type="file" accept="image/*"><button class="btn secondary full" id="exGps">📍 GPS Verify</button><div id="exGpsStatus" class="status">GPS এখনো verify হয়নি।</div><button class="btn primary full" id="exSubmit">🚀 Submit Explore</button><div id="exStatus" class="status"></div></div></div>`;
  document.body.insertAdjacentHTML("beforeend",html);
  fillDivisionSelect();
  $("#closeExplore").onclick=()=>$("#exploreModal")?.remove();
  $("#exDivision").onchange=()=>{fillDistrictSelect();fillUpazilaSelect();fillUnionSelect();};
  $("#exDistrict").onchange=()=>{fillUpazilaSelect();fillUnionSelect();};
  $("#exUpazila").onchange=()=>fillUnionSelect();
  let gps=null;
  $("#exGps").onclick=()=>getGPS((pos)=>{gps=pos;$("#exGpsStatus").textContent=`📍 ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} — GPS captured`;});
  $("#exSubmit").onclick=()=>submitExplore(gps);
}

function fillDivisionSelect(){
  const s=$("#exDivision"); if(!s)return;
  s.innerHTML='<option value="">বিভাগ নির্বাচন</option>'+BD.map((d,i)=>`<option value="${i}">${esc(d.bn_name||d.name)}</option>`).join("");
}
function fillDistrictSelect(){
  const di=Number($("#exDivision")?.value); const s=$("#exDistrict"); if(!s)return;
  const d=BD[di]; s.innerHTML='<option value="">জেলা নির্বাচন</option>'+(d?.districts||[]).map((x,i)=>`<option value="${i}">${esc(x.bn_name||x.name)}</option>`).join("");
}
function fillUpazilaSelect(){
  const di=Number($("#exDivision")?.value), xi=Number($("#exDistrict")?.value); const s=$("#exUpazila"); if(!s)return;
  const x=BD[di]?.districts?.[xi]; s.innerHTML='<option value="">উপজেলা নির্বাচন</option>'+(x?.upazilas||[]).map((u,i)=>`<option value="${i}">${esc(u.bn_name||u.name)}</option>`).join("");
}
function fillUnionSelect(){
  const di=Number($("#exDivision")?.value), xi=Number($("#exDistrict")?.value), ui=Number($("#exUpazila")?.value); const s=$("#exUnion"); if(!s)return;
  const u=BD[di]?.districts?.[xi]?.upazilas?.[ui]; s.innerHTML='<option value="">ইউনিয়ন / Ward নির্বাচন</option>'+(u?.unions||[]).map((n)=>`<option value="${esc(n.bn_name||n.name)}">${esc(n.bn_name||n.name)}</option>`).join("");
}
function getSelectedLocation(){
  const di=Number($("#exDivision")?.value), xi=Number($("#exDistrict")?.value), ui=Number($("#exUpazila")?.value);
  const d=BD[di], x=d?.districts?.[xi], u=x?.upazilas?.[ui];
  return {division:d?.bn_name||d?.name||"",district:x?.bn_name||x?.name||"",upazila:u?.bn_name||u?.name||"",union_name:$("#exUnion")?.value||"",village:$("#exVillage")?.value.trim()||"",mouza:$("#exMouza")?.value.trim()||""};
}

async function submitExplore(gps){
  if(!gps){$("#exStatus").textContent="আগে GPS Verify করুন।";return;}
  const file=$("#exPhoto")?.files?.[0]; if(!file){$("#exStatus").textContent="একটি photo নির্বাচন করুন।";return;}
  const loc=getSelectedLocation(); if(!loc.district){$("#exStatus").textContent="কমপক্ষে জেলা নির্বাচন করুন।";return;}
  const btn=$("#exSubmit"); btn.disabled=true; btn.textContent="⏳ Uploading…";
  try{
    const uploaded=await uploadCloudinary(file);
    const caption=$("#exCaption")?.value.trim()||"";
    const {data,error}=await supabase.from("submissions").insert({
      user_id:currentUser.id, mission_id:null, cloudinary_url:uploaded.secure_url, cloudinary_public_id:uploaded.public_id,
      captured_lat:gps.lat,captured_lng:gps.lng,distance_m:null,gps_verified:true,status:"pending",caption,
      ...loc
    }).select("*").single();
    if(error)throw error;
    $("#exStatus").innerHTML='<span class="ok">✅ Explore submitted. Admin approval-এর পর leaderboard count হবে।</span>';
    btn.textContent="Submitted ✓";
    await showPhotoCard({submission:data,username:currentProfile?.username||"Explorer",pending:true,file});
  }catch(e){$("#exStatus").innerHTML=`<span class="bad">❌ ${esc(e.message)}</span>`;btn.disabled=false;btn.textContent="🚀 Submit Explore";}
}

async function uploadCloudinary(file){
  if(!CONFIG.cloudinaryCloudName||!CONFIG.cloudinaryUploadPreset){
    throw new Error("Cloudinary config নেই। Render Environment-এ CLOUDINARY_CLOUD_NAME এবং CLOUDINARY_UPLOAD_PRESET check করুন।");
  }
  if(!file.type.startsWith("image/")) throw new Error("শুধু image file upload করা যাবে।");
  if(file.size > 10 * 1024 * 1024) throw new Error("Photo size 10MB-এর বেশি হতে পারবে না.");
  const fd=new FormData();
  fd.append("file",file);
  fd.append("upload_preset",CONFIG.cloudinaryUploadPreset);
  fd.append("folder","photo-hunt-bd");
  let r;
  try{
    r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CONFIG.cloudinaryCloudName)}/image/upload`,{method:"POST",body:fd});
  }catch(e){
    throw new Error("Cloudinary-তে connection করা যাচ্ছে না। Internet/CORS বা Upload Preset check করুন।");
  }
  const text=await r.text();
  let d={};
  try{ d=JSON.parse(text); }catch{}
  if(!r.ok) throw new Error(d?.error?.message || `Cloudinary upload failed (${r.status})`);
  if(!d.secure_url) throw new Error("Cloudinary response-এ image URL পাওয়া যায়নি.");
  return d;
}

async function loadMissions(){
  let missions=[];
  if(supabase){const {data}=await supabase.from("missions").select("*").eq("active",true).order("created_at",{ascending:false});missions=data||[];}
  if(missions.length) renderMissions(missions); else renderFallbackMissions();
}
function renderFallbackMissions(){
  $("#missionGrid").innerHTML=fallbackMissions.map(m=>`<article class="mission"><div class="icon">${m.icon}</div><h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><div class="xp">Explore + Photo</div><button class="btn primary" style="margin-top:15px" onclick="window.startGenericExplore()">📸 এই ধরনের Explore</button></article>`).join("");
}
function renderMissions(ms){
  $("#missionGrid").innerHTML=ms.map(m=>`<article class="mission"><div class="icon">📍</div><h3>${esc(m.title)}</h3><p>${esc(m.description||"এই location explore করুন এবং photo proof দিন।")}</p><div class="chips"><span class="chip">${esc(m.district||"")}</span>${m.upazila?`<span class="chip">${esc(m.upazila)}</span>`:""}<span class="chip">+${m.xp||100} XP</span></div><button class="btn primary" style="margin-top:15px" onclick="window.openMission('${m.id}')">📸 Explore this place</button></article>`).join("");
}
window.startGenericExplore=openExploreModal;
window.openMission=async(id)=>{
  if(!currentUser){openAuthModal();return;}
  const {data,error}=await supabase.from("missions").select("*").eq("id",id).single();
  if(error||!data){alert("Mission পাওয়া যায়নি।");return;}
  openMissionModal(data);
};
function openMissionModal(m){
  const html=`<div class="modal" id="missionModal"><div class="modal-card wide"><button class="x" id="closeMission">×</button><div class="modal-icon">📍</div><h2>${esc(m.title)}</h2><p>${esc(m.description||"")}</p><div class="chips"><span class="chip">${esc(m.district||"")}</span>${m.upazila?`<span class="chip">${esc(m.upazila)}</span>`:""}<span class="chip">${m.latitude}, ${m.longitude}</span></div><input id="mCaption" placeholder="Photo caption…"><input id="mPhoto" type="file" accept="image/*"><button class="btn secondary full" id="mGps">📍 GPS Verify</button><div id="mGpsStatus" class="status">GPS এখনো verify হয়নি।</div><button class="btn primary full" id="mSubmit">🚀 Submit Photo</button><div id="mStatus" class="status"></div></div></div>`;
  document.body.insertAdjacentHTML("beforeend",html); $("#closeMission").onclick=()=>$("#missionModal")?.remove(); let gps=null;
  $("#mGps").onclick=()=>getGPS(pos=>{gps=pos;const dist=distance(pos.lat,pos.lng,Number(m.latitude),Number(m.longitude));$("#mGpsStatus").textContent=`📍 ${Math.round(dist)}m from mission`;gps.distance=dist;});
  $("#mSubmit").onclick=async()=>{
    const file=$("#mPhoto")?.files?.[0]; if(!file){$("#mStatus").textContent="Photo নির্বাচন করুন।";return;} if(!gps){$("#mStatus").textContent="GPS Verify করুন।";return;}
    const radius=Number(m.radius_m||150); if(gps.distance>radius){$("#mStatus").innerHTML=`<span class="bad">❌ আপনি mission radius-এর বাইরে (${Math.round(gps.distance)}m)।</span>`;return;}
    const b=$("#mSubmit");b.disabled=true;b.textContent="⏳ Uploading…";
    try{const up=await uploadCloudinary(file);const loc={division:m.division||"",district:m.district||"",upazila:m.upazila||"",union_name:m.union_name||"",village:m.village||"",mouza:m.mouza||""};const {data,error}=await supabase.from("submissions").insert({user_id:currentUser.id,mission_id:m.id,cloudinary_url:up.secure_url,cloudinary_public_id:up.public_id,captured_lat:gps.lat,captured_lng:gps.lng,distance_m:gps.distance,gps_verified:true,status:"pending",caption:$("#mCaption")?.value.trim()||"",...loc}).select("*").single();if(error)throw error;$("#mStatus").innerHTML='<span class="ok">✅ Photo submitted. Admin approval-এর পর Explore count হবে।</span>';b.textContent="Submitted ✓";await showPhotoCard({submission:data,username:currentProfile?.username||"Explorer",pending:true,file});}catch(e){$("#mStatus").innerHTML=`<span class="bad">❌ ${esc(e.message)}</span>`;b.disabled=false;b.textContent="🚀 Submit Photo";}
  };
}

function getGPS(cb){
  if(!navigator.geolocation){alert("এই device/browser GPS support করে না।");return;}
  navigator.geolocation.getCurrentPosition(p=>cb({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),e=>alert("GPS permission দিন এবং Location চালু রাখুন।"),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
}
function distance(lat1,lon1,lat2,lon2){const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

async function renderLeaderboard(){
  const box=$("#leaderboardList"); if(!box||!supabase)return;
  const {data,error}=await supabase.from("profiles").select("id,username,total_explores,districts_explored,upazilas_explored,unions_explored").order("total_explores",{ascending:false}).order("districts_explored",{ascending:false}).limit(50);
  if(error){box.innerHTML=`<div class="empty small">Leaderboard load হয়নি।</div>`;return;}
  if(!data?.length){box.innerHTML=`<div class="empty small">প্রথম Explorer হোন! 📸</div>`;return;}
  box.innerHTML=data.map((u,i)=>`<div class="leader-row"><div class="rank">${i<3?["🥇","🥈","🥉"][i]:`#${i+1}`}</div><div class="leader-main"><b>${esc(u.username||"Explorer")}</b><small>${u.districts_explored||0} district • ${u.upazilas_explored||0} upazila • ${u.unions_explored||0} union</small></div><div class="explore-score"><b>${u.total_explores||0}</b><span>places explored</span></div></div>`).join("");
}

async function loadCommunityPhotos(){
  const box=$("#photoGrid"); if(!box||!supabase)return;
  const {data,error}=await supabase.from("submissions").select("id,user_id,cloudinary_url,caption,division,district,upazila,union_name,village,mouza,created_at").eq("status","approved").order("created_at",{ascending:false}).limit(12);
  if(error||!data?.length){box.innerHTML=`<div class="empty small">Approved exploration photos এখানে দেখাবে।</div>`;return;}
  const ids=[...new Set(data.map(x=>x.user_id))]; let names={}; if(ids.length){const {data:p}=await supabase.from("profiles").select("id,username").in("id",ids);(p||[]).forEach(x=>names[x.id]=x.username);}
  box.innerHTML=data.map(x=>`<article class="photo-card"><img src="${esc(x.cloudinary_url)}" alt="${esc([x.village,x.union_name,x.upazila,x.district,x.division].filter(Boolean).join(" • ")||"Bangladesh")}" loading="lazy"><div class="photo-card-body"><small>📍 ${esc(x.location_label||x.district||"Bangladesh")}</small><h3>${esc(names[x.user_id]||"Explorer")}</h3><p>${esc(x.caption||"")}</p><button class="btn secondary" onclick="window.shareExistingCard('${x.id}')">↗ Share card</button></div></article>`).join("");
}
window.shareExistingCard=async(id)=>{
  if(!supabase)return; const {data}=await supabase.from("submissions").select("*").eq("id",id).single(); if(!data)return; const {data:p}=await supabase.from("profiles").select("username").eq("id",data.user_id).single(); await showPhotoCard({submission:data,username:p?.username||"Explorer"});
};

async function showPhotoCard({submission,username,pending=false,file=null}){
  const card=document.createElement("div");card.className="share-card-preview";card.id="sharePreview";
  card.innerHTML=`<div class="share-card-image"><img id="cardImg" src="${esc(submission.cloudinary_url||"")}" alt=""></div><div class="share-card-copy"><span>🇧🇩 PHOTO HUNT BD</span><h2>${esc(submission.location_label||submission.district||"Bangladesh")}</h2><p>${esc(submission.caption||"I explored Bangladesh.")}</p><b>📸 ${esc(username||"Explorer")}</b><small>${pending?"Pending admin verification":"Verified Explore"}</small></div>`;
  const wrap=document.createElement("div");wrap.className="modal";wrap.id="shareModal";const panel=document.createElement("div");panel.className="modal-card wide";const close=document.createElement("button");close.className="x";close.textContent="×";close.onclick=()=>wrap.remove();panel.appendChild(close);panel.insertAdjacentHTML("beforeend","<h2>Share your Bangladesh Photo Card</h2><p class='sub'>এই card-টা social media-তে share করতে পারবেন।</p>");panel.appendChild(card);panel.insertAdjacentHTML("beforeend",`<div class="share-actions"><button class="btn primary" id="shareNative">📤 Share</button><button class="btn secondary" id="downloadCard">⬇ Save Card</button><button class="btn secondary" id="waShare">WhatsApp</button><button class="btn secondary" id="fbShare">Facebook</button><button class="btn secondary" id="xShare">X</button><button class="btn secondary" id="copyShare">Copy text</button></div><div class="status" id="shareStatus"></div>`);wrap.appendChild(panel);document.body.appendChild(wrap);
  const img=card.querySelector("#cardImg");if(file){img.src=URL.createObjectURL(file);} await waitImage(img);
  const blob=await cardToBlob(card);
  const filename=`photo-hunt-bd-${submission.id||Date.now()}.png`;
  $("#downloadCard").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();};
  $("#shareNative").onclick=async()=>{try{const f=new File([blob],filename,{type:"image/png"});if(navigator.share&&navigator.canShare?.({files:[f]})){await navigator.share({title:"Photo Hunt BD",text:`${submission.location_label||"Bangladesh"} — explored by ${username}`,files:[f]});}else{await navigator.share?.({title:"Photo Hunt BD",text:`${submission.location_label||"Bangladesh"} — explored by ${username}`});}}catch(e){}}
  $("#waShare").onclick=()=>socialShare("https://wa.me/?text=",`${submission.location_label||"Bangladesh"} — explored by ${username} 🇧🇩`);
  $("#fbShare").onclick=()=>socialShare("https://www.facebook.com/sharer/sharer.php?u=",location.href);
  $("#xShare").onclick=()=>socialShare("https://twitter.com/intent/tweet?text=",`${submission.location_label||"Bangladesh"} — explored by ${username} 🇧🇩 ${location.href}`);
  $("#copyShare").onclick=async()=>{await navigator.clipboard?.writeText(`${submission.location_label||"Bangladesh"} — explored by ${username} 🇧🇩\n${location.href}`);$("#shareStatus").textContent="Share text copied ✅";};
}
function socialShare(base,text){window.open(base+encodeURIComponent(text),"_blank","noopener,noreferrer,width=720,height=600");}
function waitImage(img){return new Promise(resolve=>{if(img.complete)return resolve();img.onload=resolve;img.onerror=resolve;});}
async function cardToBlob(card){
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=1080;canvas.height=1350;ctx.fillStyle="#06130d";ctx.fillRect(0,0,1080,1350);
  const img=card.querySelector("img"), iw=img.naturalWidth||1080, ih=img.naturalHeight||700, scale=Math.max(1080/iw,700/ih), w=iw*scale,h=ih*scale;ctx.save();ctx.beginPath();ctx.rect(0,0,1080,700);ctx.clip();ctx.drawImage(img,(1080-w)/2,(700-h)/2,w,h);ctx.restore();
  ctx.fillStyle="#06130d";ctx.fillRect(0,700,1080,650);ctx.fillStyle="#20d46b";ctx.font="700 30px Inter, sans-serif";ctx.fillText("🇧🇩 PHOTO HUNT BD",60,760);ctx.fillStyle="#ffffff";ctx.font="800 52px 'Noto Sans Bengali', sans-serif";wrapText(ctx,card.querySelector("h2")?.textContent||"Bangladesh",60,835,930,62);ctx.fillStyle="#9db7a8";ctx.font="400 28px 'Noto Sans Bengali', sans-serif";wrapText(ctx,card.querySelector("p")?.textContent||"",60,1010,930,40);ctx.fillStyle="#ffffff";ctx.font="700 30px Inter, sans-serif";ctx.fillText(card.querySelector("b")?.textContent||"Explorer",60,1190);ctx.fillStyle="#20d46b";ctx.font="700 24px Inter, sans-serif";ctx.fillText(card.querySelector("small")?.textContent||"Verified Explore",60,1250);return new Promise(r=>canvas.toBlob(r,"image/png",.94));
}
function wrapText(ctx,text,x,y,maxWidth,lineHeight){const words=text.split(/\s+/);let line="";for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=word;y+=lineHeight;}else line=test;}if(line)ctx.fillText(line,x,y);}

async function loadData(){
  try{const r=await fetch(CONFIG.geoUrl);BD=await r.json();let districts=0,upazilas=0,unions=0;BD.forEach(d=>{districts+=d.districts?.length||0;d.districts?.forEach(x=>{upazilas+=x.upazilas?.length||0;x.upazilas?.forEach(u=>unions+=u.unions?.length||0)})});$("#divisionCount").textContent=BD.length;$("#districtCount").textContent=districts;$("#upazilaCount").textContent=upazilas;$("#unionCount").textContent=unions;$("#dataStatus").textContent=`${districts} জেলা • ${upazilas} উপজেলা`;renderTree();}catch(e){console.error(e);$("#dataStatus").textContent="Data unavailable";}
}
function renderTree(list=BD){$("#tree").innerHTML=list.map((d,i)=>`<div class="tree-item" onclick="window.showDivision(${i})"><strong>🇧🇩 ${esc(d.bn_name||d.name)}</strong><small>${d.districts?.length||0} জেলা</small></div>`).join("");}
window.showDivision=(i)=>{const d=BD[i];$("#crumb").textContent=d.bn_name||d.name;$("#tree").innerHTML=(d.districts||[]).map((x,j)=>`<div class="tree-item" onclick="window.showDistrict(${i},${j})"><strong>${esc(x.bn_name||x.name)}</strong><small>${x.upazilas?.length||0} উপজেলা</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(d.bn_name||d.name)}</h3><p class="sub">এই বিভাগের জেলা নির্বাচন করুন।</p><div class="chips">${(d.districts||[]).map(x=>`<span class="chip">${esc(x.bn_name||x.name)}</span>`).join("")}</div>`;};
window.showDistrict=(di,xi)=>{const d=BD[di],x=d?.districts?.[xi];if(!x)return;$("#crumb").textContent=`${d.bn_name||d.name} / ${x.bn_name||x.name}`;$("#tree").innerHTML=(x.upazilas||[]).map((u,j)=>`<div class="tree-item" onclick="window.showUpazila(${di},${xi},${j})"><strong>${esc(u.bn_name||u.name)}</strong><small>${u.unions?.length||0} ইউনিয়ন</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(x.bn_name||x.name)}</h3><p class="sub">উপজেলা নির্বাচন করুন।</p>`;};
window.showUpazila=(di,xi,ui)=>{const u=BD[di]?.districts?.[xi]?.upazilas?.[ui];if(!u)return;$("#crumb").textContent=`${BD[di].bn_name||BD[di].name} / ${BD[di].districts[xi].bn_name||BD[di].districts[xi].name} / ${u.bn_name||u.name}`;$("#tree").innerHTML=(u.unions||[]).map(n=>`<div class="tree-item"><strong>${esc(n.bn_name||n.name)}</strong><small>ইউনিয়ন</small></div>`).join("");$("#detail").innerHTML=`<h3>${esc(u.bn_name||u.name)}</h3><p class="sub">এই উপজেলার ইউনিয়নগুলো দেখুন।</p><div class="chips">${(u.unions||[]).map(n=>`<span class="chip">${esc(n.bn_name||n.name)}</span>`).join("")}</div>`;};
function searchLocations(){const q=$("#searchBox")?.value.trim().toLowerCase();if(!q){renderTree();return;}const out=[];BD.forEach((d,di)=>{const dn=d.bn_name||d.name||"";if(dn.toLowerCase().includes(q))out.push({label:dn,sub:"বিভাগ",fn:`window.showDivision(${di})`});d.districts?.forEach((x,xi)=>{const xn=x.bn_name||x.name||"";if(xn.toLowerCase().includes(q))out.push({label:xn,sub:`জেলা • ${dn}`,fn:`window.showDistrict(${di},${xi})`});x.upazilas?.forEach((u,ui)=>{const un=u.bn_name||u.name||"";if(un.toLowerCase().includes(q))out.push({label:un,sub:`উপজেলা • ${xn}`,fn:`window.showUpazila(${di},${xi},${ui})`});});});});$("#tree").innerHTML=out.slice(0,100).map(o=>`<div class="tree-item" onclick="${o.fn}"><strong>${esc(o.label)}</strong><small>${esc(o.sub)}</small></div>`).join("")||`<div class="empty small">কিছু পাওয়া যায়নি।</div>`;}

async function initMap(){if(!window.L||!$("#map"))return;const map=L.map("map",{zoomControl:false,scrollWheelZoom:false}).setView([23.685,90.3563],7);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);try{const r=await fetch(CONFIG.boundaryUrl);if(!r.ok)return;const gj=await r.json();L.geoJSON(gj,{style:{color:"#20d46b",weight:1,fillColor:"#0f5a37",fillOpacity:.35}}).addTo(map);}catch(e){console.error(e)}}

async function init(){
  await loadConfig(); await loadData(); await loadMissions(); await renderLeaderboard(); await loadCommunityPhotos(); await initMap(); updateAuthButton();
}

$("#authBtn")?.addEventListener("click",openAuthModal);
$("#submitAuth")?.addEventListener("click",submitAuth);
$("#toggleAuth")?.addEventListener("click",()=>setAuthMode(authMode==="login"?"signup":"login"));
document.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",()=>$("#authModal")?.classList.add("hidden")));
$("#exploreNowBtn")?.addEventListener("click",openExploreModal);
$("#nearbyBtn")?.addEventListener("click",()=>{if(!currentUser){openAuthModal();return;}getGPS(async pos=>{if(!supabase)return;const {data}=await supabase.from("missions").select("*").eq("active",true).limit(100);let nearest=null,nd=Infinity;(data||[]).forEach(m=>{if(m.latitude!=null&&m.longitude!=null){const d=distance(pos.lat,pos.lng,Number(m.latitude),Number(m.longitude));if(d<nd){nd=d;nearest=m;}}});if(nearest)alert(`📍 ${nearest.title}\n${Math.round(nd)}m দূরে`);else alert("GPS coordinates সহ mission পাওয়া যায়নি।");});});
$("#searchBtn")?.addEventListener("click",searchLocations);$("#searchBox")?.addEventListener("keydown",e=>{if(e.key==="Enter")searchLocations();});

init();
