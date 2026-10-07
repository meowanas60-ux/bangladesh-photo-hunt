import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIG = {
  geoUrl:
    "https://iqbalhasandev.github.io/bangladesh-geo-json/bangladesh-geo.json",

  boundaryUrl:
    "https://raw.githubusercontent.com/meetshaks/bangladesh-administrative-boundaries-json/main/bgd_admin1.geojson",

  supabaseUrl: "",
  supabaseKey: "",

  cloudinaryCloudName: "",
  cloudinaryUploadPreset: ""
};

const $ = (s) => document.querySelector(s);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));

let BD = [];
let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentMission = null;
let authMode = "login";

/* =========================================================
   INITIAL CONFIG
========================================================= */

async function loadConfig() {
  try {
    const res = await fetch("/api/config", {
      cache: "no-store"
    });

    if (!res.ok) throw new Error("Config request failed");

    const data = await res.json();

    CONFIG.supabaseUrl =
      data.supabaseUrl ||
      data.NEXT_PUBLIC_SUPABASE_URL ||
      "";

    CONFIG.supabaseKey =
      data.supabasePublishableKey ||
      data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      data.supabaseAnonKey ||
      "";

    CONFIG.cloudinaryCloudName =
      data.cloudinaryCloudName ||
      "";

    CONFIG.cloudinaryUploadPreset =
      data.cloudinaryUploadPreset ||
      "";

    if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
      supabase = createClient(
        CONFIG.supabaseUrl,
        CONFIG.supabaseKey
      );

      await initAuth();
    } else {
      console.warn("Supabase config not available.");
    }
  } catch (error) {
    console.error("Config error:", error);
  }
}

/* =========================================================
   AUTH
========================================================= */

async function initAuth() {
  if (!supabase) return;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session?.user) {
    await handleUser(session.user);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await handleUser(session.user);
    } else {
      currentUser = null;
      currentProfile = null;
      updateAuthButton();
      renderLeaderboard();
    }
  });
}

async function handleUser(user) {
  currentUser = user;

  await ensureProfile(user);
  await loadProfile();

  updateAuthButton();
  await renderLeaderboard();
}

async function ensureProfile(user) {
  if (!supabase) return;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    const username =
      user.email?.split("@")[0] ||
      `hunter_${user.id.slice(0, 6)}`;

    await supabase.from("profiles").insert({
      id: user.id,
      username,
      xp: 0,
      missions_completed: 0,
      districts_completed: 0,
      streak: 0
    });
  }
}

async function loadProfile() {
  if (!supabase || !currentUser) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!error) {
    currentProfile = data;
  }
}

function updateAuthButton() {
  const btn = $("#authBtn");
  if (!btn) return;

  if (currentUser) {
    btn.textContent = currentProfile?.username
      ? `👤 ${currentProfile.username}`
      : "👤 Account";

    btn.classList.remove("ghost");
    btn.onclick = openAccountModal;
  } else {
    btn.textContent = "Login";
    btn.classList.add("ghost");
    btn.onclick = openAuthModal;
  }
}

function openAuthModal() {
  $("#authModal")?.classList.remove("hidden");
  setAuthMode("login");
}

function setAuthMode(mode) {
  authMode = mode;

  const title = $("#authTitle");
  const button = $("#submitAuth");
  const toggle = $("#toggleAuth");
  const msg = $("#authMsg");

  if (!title || !button || !toggle) return;

  msg.textContent = "";

  if (mode === "login") {
    title.textContent = "Login";
    button.textContent = "Login";
    toggle.textContent = "Create account";
  } else {
    title.textContent = "Create account";
    button.textContent = "Create account";
    toggle.textContent = "Already have an account? Login";
  }
}

async function submitAuth() {
  if (!supabase) {
    showAuthMessage(
      "Supabase connect হয়নি। Render Environment Variables check করুন।",
      true
    );
    return;
  }

  const email = $("#email")?.value.trim();
  const password = $("#password")?.value;

  if (!email || !password) {
    showAuthMessage("Email এবং password দিন।", true);
    return;
  }

  const button = $("#submitAuth");

  if (button) button.disabled = true;

  try {
    let result;

    if (authMode === "login") {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    } else {
      result = await supabase.auth.signUp({
        email,
        password
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (authMode === "login") {
      showAuthMessage("Login successful ✅", false);

      setTimeout(() => {
        $("#authModal")?.classList.add("hidden");
      }, 700);
    } else {
      showAuthMessage(
        "Account তৈরি হয়েছে। Email verification লাগতে পারে।",
        false
      );
    }
  } catch (error) {
    showAuthMessage(error.message || "Authentication failed.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

function showAuthMessage(message, error = false) {
  const el = $("#authMsg");
  if (!el) return;

  el.textContent = message;
  el.style.marginTop = "12px";
  el.style.fontSize = "14px";
  el.style.color = error ? "#ff6b6b" : "#20d46b";
}

async function logout() {
  if (!supabase) return;

  await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;

  updateAuthButton();

  alert("Logout হয়েছে।");
}

function openAccountModal() {
  const username =
    currentProfile?.username ||
    currentUser?.email ||
    "Hunter";

  const xp = currentProfile?.xp || 0;
  const completed = currentProfile?.missions_completed || 0;

  const html = `
    <div class="modal hidden" id="accountDynamicModal">
      <div class="modal-card">
        <button class="x" id="closeAccountModal">×</button>

        <div style="font-size:48px;text-align:center">📸</div>

        <h2 style="text-align:center">${esc(username)}</h2>

        <p style="text-align:center;color:var(--muted)">
          ${esc(currentUser?.email || "")}
        </p>

        <div class="chips" style="justify-content:center;margin:20px 0">
          <span class="chip">⭐ ${xp} XP</span>
          <span class="chip">📸 ${completed} Missions</span>
        </div>

        <button class="btn primary full" id="logoutBtn">
          Logout
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  const modal = $("#accountDynamicModal");

  modal.classList.remove("hidden");

  $("#closeAccountModal").onclick = () => modal.remove();

  $("#logoutBtn").onclick = async () => {
    modal.remove();
    await logout();
  };
}

/* =========================================================
   AUTH UI EVENTS
========================================================= */

$("#authBtn")?.addEventListener("click", openAuthModal);

$("#submitAuth")?.addEventListener(
  "click",
  submitAuth
);

$("#toggleAuth")?.addEventListener("click", () => {
  setAuthMode(
    authMode === "login"
      ? "signup"
      : "login"
  );
});

document
  .querySelectorAll("[data-close]")
  .forEach((x) => {
    x.addEventListener("click", () => {
      $("#authModal")?.classList.add("hidden");
    });
  });

/* =========================================================
   STATIC FALLBACK MISSIONS
========================================================= */

const fallbackMissions = [
  {
    icon: "🏛️",
    title: "Heritage Hunt",
    text:
      "নিজের এলাকার বাস্তব ঐতিহাসিক/স্থাপত্য spot-এর ছবি তুলুন।",
    xp: 200
  },
  {
    icon: "🌿",
    title: "Nature Hunt",
    text:
      "নদী, বিল, হাওর, বন বা গ্রামের প্রকৃতির একটি original shot।",
    xp: 150
  },
  {
    icon: "📍",
    title: "Local Landmark",
    text:
      "আপনার ইউনিয়ন/ওয়ার্ডের পরিচিত landmark capture করুন।",
    xp: 100
  }
];

async function loadMissions() {
  let missions = [];

  if (supabase) {
    const { data, error } = await supabase
      .from("missions")
      .select("*")
      .eq("active", true)
      .order("created_at", {
        ascending: false
      });

    if (!error && data?.length) {
      missions = data;
    }
  }

  if (!missions.length) {
    renderFallbackMissions();
    return;
  }

  renderRealMissions(missions);
}

function renderFallbackMissions() {
  const grid = $("#missionGrid");
  if (!grid) return;

  grid.innerHTML = fallbackMissions
    .map(
      (m, i) => `
      <article class="mission">
        <div class="icon">${m.icon}</div>
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.text)}</p>
        <div class="xp">+${m.xp} XP</div>

        <button
          class="btn secondary"
          style="margin-top:15px"
          onclick="requireLogin()"
        >
          Mission খুলুন →
        </button>
      </article>
    `
    )
    .join("");
}

function renderRealMissions(missions) {
  const grid = $("#missionGrid");
  if (!grid) return;

  grid.innerHTML = missions
    .map(
      (m) => `
      <article class="mission">
        <div class="icon">📸</div>

        <h3>${esc(m.title)}</h3>

        <p>${esc(
          m.description ||
          "এই location-এ ছবি তুলে Mission complete করুন।"
        )}</p>

        <div class="xp">+${m.xp || 0} XP</div>

        <div style="font-size:13px;color:var(--muted);margin-top:10px">
          ${esc(m.district || "")}
          ${m.upazila ? " • " + esc(m.upazila) : ""}
        </div>

        <button
          class="btn primary"
          style="margin-top:15px"
          onclick="openMission('${m.id}')"
        >
          📸 Mission শুরু
        </button>
      </article>
    `
    )
    .join("");
}

window.requireLogin = function () {
  if (!currentUser) {
    openAuthModal();
    return;
  }

  alert("Real missions database থেকে load হবে।");
};

/* =========================================================
   REAL MISSION
========================================================= */

window.openMission = async function (missionId) {
  if (!currentUser) {
    openAuthModal();
    return;
  }

  if (!supabase) {
    alert("Supabase connect হয়নি।");
    return;
  }

  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error || !data) {
    alert("Mission পাওয়া যায়নি।");
    return;
  }

  currentMission = data;

  openMissionUploadModal(data);
};

function openMissionUploadModal(mission) {
  $("#missionUploadModal")?.remove();

  const html = `
    <div class="modal" id="missionUploadModal">

      <div class="modal-card">

        <button class="x" id="closeMissionModal">×</button>

        <div style="font-size:42px;text-align:center">📸</div>

        <h2>${esc(mission.title)}</h2>

        <p>
          ${esc(
            mission.description ||
            "এই location-এর একটি original photo upload করুন।"
          )}
        </p>

        <div class="chips">
          ${
            mission.district
              ? `<span class="chip">📍 ${esc(
                  mission.district
                )}</span>`
              : ""
          }

          ${
            mission.upazila
              ? `<span class="chip">${esc(
                  mission.upazila
                )}</span>`
              : ""
          }

          <span class="chip">
            ⭐ +${mission.xp || 0} XP
          </span>
        </div>

        <label
          style="
            display:block;
            margin-top:18px;
            margin-bottom:8px;
            font-weight:700
          "
        >
          আপনার ছবি
        </label>

        <input
          id="missionPhoto"
          type="file"
          accept="image/*"
          style="width:100%"
        >

        <button
          class="btn secondary full"
          id="gpsBtn"
          style="margin-top:14px"
        >
          📍 GPS Verify
        </button>

        <div
          id="gpsStatus"
          style="
            margin-top:10px;
            font-size:13px;
            color:var(--muted)
          "
        >
          GPS এখনো verify হয়নি।
        </div>

        <button
          class="btn primary full"
          id="submitMissionBtn"
          style="margin-top:18px"
        >
          🚀 Submit Mission
        </button>

        <div
          id="missionStatus"
          style="margin-top:12px"
        ></div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    "beforeend",
    html
  );

  $("#closeMissionModal").onclick = () => {
    $("#missionUploadModal")?.remove();
  };

  let gpsPosition = null;

  $("#gpsBtn").onclick = () => {
    getGPSForMission(
      mission,
      (position) => {
        gpsPosition = position;
      }
    );
  };

  $("#submitMissionBtn").onclick = () => {
    submitMissionPhoto(
      mission,
      gpsPosition
    );
  };
}

/* =========================================================
   GPS
========================================================= */

function getGPSForMission(mission, callback) {
  const status = $("#gpsStatus");

  if (!navigator.geolocation) {
    if (status)
      status.textContent =
        "এই browser GPS support করে না।";

    return;
  }

  if (status)
    status.textContent =
      "📍 GPS location নেওয়া হচ্ছে...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      let distance = null;

      if (
        mission.latitude != null &&
        mission.longitude != null
      ) {
        distance = calculateDistance(
          lat,
          lng,
          Number(mission.latitude),
          Number(mission.longitude)
        );
      }

      if (status) {
        status.textContent =
          distance == null
            ? `GPS পাওয়া গেছে: ${lat.toFixed(
                5
              )}, ${lng.toFixed(5)}`
            : `GPS পাওয়া গেছে • Mission থেকে ${Math.round(
                distance
              )}m দূরে`;
      }

      callback({
        lat,
        lng,
        distance
      });
    },
    (error) => {
      if (status)
        status.textContent =
          "GPS permission দিন অথবা location service চালু করুন।";

      console.error(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371000;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

/* =========================================================
   CLOUDINARY
========================================================= */

async function uploadToCloudinary(file) {
  if (
    !CONFIG.cloudinaryCloudName ||
    !CONFIG.cloudinaryUploadPreset
  ) {
    throw new Error(
      "Cloudinary configuration এখনো সেট করা হয়নি।"
    );
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append(
    "upload_preset",
    CONFIG.cloudinaryUploadPreset
  );

  const url =
    `https://api.cloudinary.com/v1_1/` +
    `${CONFIG.cloudinaryCloudName}/image/upload`;

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(
      "Cloudinary upload failed."
    );
  }

  return response.json();
}

/* =========================================================
   SUBMIT MISSION
========================================================= */

async function submitMissionPhoto(
  mission,
  gpsPosition
) {
  const fileInput = $("#missionPhoto");
  const status = $("#missionStatus");
  const button = $("#submitMissionBtn");

  if (!fileInput?.files?.length) {
    if (status)
      status.innerHTML =
        `<span style="color:#ff6b6b">
          আগে একটি ছবি নির্বাচন করুন।
        </span>`;

    return;
  }

  if (!gpsPosition) {
    if (status)
      status.innerHTML =
        `<span style="color:#ff6b6b">
          আগে GPS Verify করুন।
        </span>`;

    return;
  }

  const file = fileInput.files[0];

  if (!file.type.startsWith("image/")) {
    if (status)
      status.textContent =
        "শুধু image file upload করুন।";

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent =
      "⏳ Upload হচ্ছে...";
  }

  try {
    const uploaded =
      await uploadToCloudinary(file);

    const radius =
      Number(mission.radius_m || 100);

    const gpsVerified =
      gpsPosition.distance == null
        ? false
        : gpsPosition.distance <= radius;

    const { error } = await supabase
      .from("submissions")
      .insert({
        user_id: currentUser.id,
        mission_id: mission.id,

        cloudinary_url:
          uploaded.secure_url,

        cloudinary_public_id:
          uploaded.public_id,

        captured_lat:
          gpsPosition.lat,

        captured_lng:
          gpsPosition.lng,

        distance_m:
          gpsPosition.distance,

        gps_verified:
          gpsVerified,

        status:
          gpsVerified
            ? "pending"
            : "rejected"
      });

    if (error) {
      throw error;
    }

    if (status) {
      status.innerHTML = gpsVerified
        ? `<span style="color:#20d46b">
            ✅ Submission received! Admin verification-এর জন্য pending.
          </span>`
        : `<span style="color:#ff6b6b">
            ❌ আপনি Mission location-এর বাইরে আছেন।
          </span>`;
    }

    if (button) {
      button.textContent =
        "✅ Submitted";
      button.disabled = true;
    }
  } catch (error) {
    console.error(error);

    if (status) {
      status.innerHTML =
        `<span style="color:#ff6b6b">
          ❌ ${esc(error.message)}
        </span>`;
    }

    if (button) {
      button.disabled = false;
      button.textContent =
        "🚀 Submit Mission";
    }
  }
}

/* =========================================================
   LOCATION DATA
========================================================= */

async function loadData() {
  try {
    const r = await fetch(CONFIG.geoUrl);

    if (!r.ok)
      throw new Error(
        "Geo data failed"
      );

    BD = await r.json();

    let districts = 0;
    let upazilas = 0;
    let unions = 0;

    BD.forEach((d) => {
      districts +=
        d.districts?.length || 0;

      d.districts?.forEach((x) => {
        upazilas +=
          x.upazilas?.length || 0;

        x.upazilas?.forEach((u) => {
          unions +=
            u.unions?.length || 0;
        });
      });
    });

    if ($("#divisionCount"))
      $("#divisionCount").textContent =
        BD.length;

    if ($("#districtCount"))
      $("#districtCount").textContent =
        districts;

    if ($("#upazilaCount"))
      $("#upazilaCount").textContent =
        upazilas;

    if ($("#unionCount"))
      $("#unionCount").textContent =
        unions;

    if ($("#dataStatus"))
      $("#dataStatus").textContent =
        `${BD.length} বিভাগ • ${districts} জেলা`;

    renderTree();
  } catch (error) {
    console.error(error);

    if ($("#dataStatus"))
      $("#dataStatus").textContent =
        "Data unavailable";

    if ($("#tree"))
      $("#tree").innerHTML =
        `<div class="empty small">
          Location data load হয়নি।
        </div>`;
  }
}

function renderTree(list = BD) {
  const tree = $("#tree");
  if (!tree) return;

  tree.innerHTML = list
    .map(
      (d, i) => `
      <div
        class="tree-item"
        onclick="showDivision(${i})"
      >
        <strong>
          🇧🇩 ${esc(d.bn_name || d.name)}
        </strong>

        <small>
          ${d.districts?.length || 0} জেলা
        </small>
      </div>
    `
    )
    .join("");
}

window.showDivision = function (i) {
  const d = BD[i];

  if (!d) return;

  $("#crumb").textContent =
    d.bn_name || d.name;

  $("#tree").innerHTML =
    (d.districts || [])
      .map(
        (x, j) => `
        <div
          class="tree-item"
          onclick="showDistrict(${i},${j})"
        >
          <strong>
            ${esc(x.bn_name || x.name)}
          </strong>

          <small>
            ${x.upazilas?.length || 0} উপজেলা
          </small>
        </div>
      `
      )
      .join("");

  $("#detail").innerHTML = `
    <h3>
      ${esc(d.bn_name || d.name)}
    </h3>

    <p style="color:var(--muted)">
      এই বিভাগের জেলা নির্বাচন করুন।
    </p>

    <div class="chips">
      ${(d.districts || [])
        .map(
          (x) =>
            `<span class="chip">
              ${esc(x.bn_name || x.name)}
            </span>`
        )
        .join("")}
    </div>
  `;
};

window.showDistrict = function (
  di,
  xi
) {
  const d = BD[di];
  const x = d?.districts?.[xi];

  if (!x) return;

  $("#crumb").textContent =
    `${d.bn_name || d.name} / ${
      x.bn_name || x.name
    }`;

  $("#tree").innerHTML =
    (x.upazilas || [])
      .map(
        (u, j) => `
        <div
          class="tree-item"
          onclick="showUpazila(${di},${xi},${j})"
        >
          <strong>
            ${esc(u.bn_name || u.name)}
          </strong>

          <small>
            ${u.unions?.length || 0} ইউনিয়ন
          </small>
        </div>
      `
      )
      .join("");

  $("#detail").innerHTML = `
    <h3>
      ${esc(x.bn_name || x.name)}
    </h3>

    <p style="color:var(--muted)">
      উপজেলা বাছাই করুন।
    </p>
  `;
};

window.showUpazila = function (
  di,
  xi,
  ui
) {
  const u =
    BD[di]?.districts?.[xi]?.upazilas?.[ui];

  if (!u) return;

  $("#crumb").textContent =
    `${BD[di].bn_name || BD[di].name} / ${
      BD[di].districts[xi].bn_name ||
      BD[di].districts[xi].name
    } / ${u.bn_name || u.name}`;

  $("#tree").innerHTML =
    (u.unions || [])
      .map(
        (n) => `
        <div class="tree-item">
          <strong>
            ${esc(n.bn_name || n.name)}
          </strong>

          <small>ইউনিয়ন</small>
        </div>
      `
      )
      .join("");

  $("#detail").innerHTML = `
    <h3>
      ${esc(u.bn_name || u.name)}
    </h3>

    <p style="color:var(--muted)">
      ইউনিয়ন নির্বাচন করুন।
    </p>

    <div class="chips">
      ${(u.unions || [])
        .map(
          (n) =>
            `<span class="chip">
              ${esc(n.bn_name || n.name)}
            </span>`
        )
        .join("")}
    </div>

    <div
      class="mission"
      style="margin-top:20px"
    >
      <b>গ্রাম / মৌজা layer</b>

      <p>
        Verified BBS/DLRS dataset ছাড়া
        গ্রাম/মৌজার নাম বানানো হচ্ছে না।
      </p>
    </div>
  `;
};

/* =========================================================
   SEARCH
========================================================= */

$("#searchBtn")?.addEventListener(
  "click",
  searchLocations
);

$("#searchBox")?.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Enter") {
      searchLocations();
    }
  }
);

function searchLocations() {
  const q =
    $("#searchBox")?.value
      .trim()
      .toLowerCase();

  if (!q) {
    renderTree();
    return;
  }

  const out = [];

  BD.forEach((d, di) => {
    const dName =
      d.bn_name || d.name || "";

    if (
      dName.toLowerCase().includes(q)
    ) {
      out.push({
        label: dName,
        sub: "বিভাগ",
        fn: `showDivision(${di})`
      });
    }

    d.districts?.forEach(
      (x, xi) => {
        const xName =
          x.bn_name || x.name || "";

        if (
          xName
            .toLowerCase()
            .includes(q)
        ) {
          out.push({
            label: xName,
            sub: `জেলা • ${dName}`,
            fn: `showDistrict(${di},${xi})`
          });
        }

        x.upazilas?.forEach(
          (u, ui) => {
            const uName =
              u.bn_name || u.name || "";

            if (
              uName
                .toLowerCase()
                .includes(q)
            ) {
              out.push({
                label: uName,
                sub: `উপজেলা • ${xName}`,
                fn: `showUpazila(${di},${xi},${ui})`
              });
            }
          }
        );
      }
    );
  });

  $("#tree").innerHTML =
    out
      .slice(0, 100)
      .map(
        (o) => `
        <div
          class="tree-item"
          onclick="${o.fn}"
        >
          <strong>
            ${esc(o.label)}
          </strong>

          <small>
            ${esc(o.sub)}
          </small>
        </div>
      `
      )
      .join("") ||
    `<div class="empty small">
      কিছু পাওয়া যায়নি।
    </div>`;
}

/* =========================================================
   MAP
========================================================= */

async function initMap() {
  if (!window.L || !$("#map")) return;

  const map = L.map("map", {
    zoomControl: false,
    scrollWheelZoom: false
  }).setView(
    [23.685, 90.3563],
    7
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        "© OpenStreetMap"
    }
  ).addTo(map);

  try {
    const r = await fetch(
      CONFIG.boundaryUrl
    );

    if (!r.ok) return;

    const gj = await r.json();

    L.geoJSON(gj, {
      style: {
        color: "#20d46b",
        weight: 1,
        fillColor: "#0f5a37",
        fillOpacity: 0.35
      },

      onEachFeature: (
        feature,
        layer
      ) => {
        layer.bindTooltip(
          feature.properties?.shapeName ||
            "Bangladesh",
          {
            sticky: true
          }
        );
      }
    }).addTo(map);
  } catch (error) {
    console.error(
      "Map boundary error:",
      error
    );
  }
}

/* =========================================================
   NEARBY GPS
========================================================= */

$("#nearbyBtn")?.addEventListener(
  "click",
  () => {
    if (!navigator.geolocation) {
      alert(
        "এই browser GPS support করে না।"
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat =
          position.coords.latitude;

        const lng =
          position.coords.longitude;

        alert(
          `📍 GPS পাওয়া গেছে\n\nLatitude: ${lat.toFixed(
            5
          )}\nLongitude: ${lng.toFixed(5)}`
        );

        await findNearbyMission(
          lat,
          lng
        );
      },
      () => {
        alert(
          "GPS permission দিন।"
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000
      }
    );
  }
);

async function findNearbyMission(
  lat,
  lng
) {
  if (!supabase) return;

  const { data } =
    await supabase
      .from("missions")
      .select("*")
      .eq("active", true)
      .limit(100);

  if (!data?.length) {
    alert(
      "এখনো কোনো GPS mission তৈরি হয়নি।"
    );
    return;
  }

  let nearest = null;
  let nearestDistance =
    Infinity;

  data.forEach((mission) => {
    if (
      mission.latitude == null ||
      mission.longitude == null
    ) {
      return;
    }

    const distance =
      calculateDistance(
        lat,
        lng,
        Number(mission.latitude),
        Number(mission.longitude)
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance = distance;
      nearest = mission;
    }
  });

  if (!nearest) {
    alert(
      "GPS coordinates সহ mission পাওয়া যায়নি।"
    );
    return;
  }

  const inside =
    nearestDistance <=
    Number(nearest.radius_m || 100);

  alert(
    inside
      ? `📍 কাছের Mission পাওয়া গেছে!\n\n${nearest.title}\nDistance: ${Math.round(
          nearestDistance
        )}m`
      : `📍 সবচেয়ে কাছের Mission:\n\n${nearest.title}\nDistance: ${Math.round(
          nearestDistance
        )}m`
  );
}

/* =========================================================
   LEADERBOARD
========================================================= */

async function renderLeaderboard() {
  const container =
    $("#leaderboardList");

  if (!container) return;

  if (!supabase) {
    container.innerHTML = `
      <div class="empty small">
        Supabase connect করলে এখানে real user ranking দেখাবে।
      </div>
    `;

    return;
  }

  const { data, error } =
    await supabase
      .from("profiles")
      .select(
        "id,username,xp,missions_completed,districts_completed,streak"
      )
      .order("xp", {
        ascending: false
      })
      .limit(20);

  if (error) {
    console.error(
      "Leaderboard:",
      error
    );

    container.innerHTML = `
      <div class="empty small">
        Leaderboard load করা যায়নি।
      </div>
    `;

    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div class="empty small">
        এখনো কোনো hunter নেই। প্রথম hunter আপনি হোন! 📸
      </div>
    `;

    return;
  }

  container.innerHTML = data
    .map(
      (user, index) => `
      <div
        class="leader-row"
        style="
          display:flex;
          align-items:center;
          gap:14px;
          padding:14px 0;
          border-bottom:1px solid rgba(255,255,255,.08)
        "
      >

        <div
          style="
            width:36px;
            height:36px;
            display:grid;
            place-items:center;
            font-weight:800
          "
        >
          ${
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `#${index + 1}`
          }
        </div>

        <div style="flex:1">
          <b>
            ${esc(
              user.username ||
                "Anonymous Hunter"
            )}
          </b>

          <div
            style="
              font-size:12px;
              color:var(--muted)
            "
          >
            ${
              user.missions_completed ||
              0
            } missions
          </div>
        </div>

        <strong>
          ⭐ ${user.xp || 0} XP
        </strong>

      </div>
    `
    )
    .join("");
}

/* =========================================================
   START
========================================================= */

async function startApp() {
  await loadConfig();

  await loadData();

  await loadMissions();

  await renderLeaderboard();

  await initMap();

  updateAuthButton();
}

startApp();
