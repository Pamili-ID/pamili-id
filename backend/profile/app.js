/* ================= FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, onAuthStateChanged, } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getDatabase, ref, get, update, set, remove, push, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnE8ZLTp58Orle6vu9Rk9xJMEajCPo7PQ",
  authDomain: "pamili-id.firebaseapp.com",
  projectId: "pamili-id",
  storageBucket: "pamili-id.appspot.com",
  messagingSenderId: "584922601978",
  appId: "1:584922601978:web:6b3f226bbc5af144bbac43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ================= GLOBAL ================= */
let myUid = null;
let viewedUid = null;
let isMyProfile = false;
let activeProfileView = "posts";

/* ================= ELEMENT ================= */
const proAvatar = document.getElementById("proAvatar");
const proUsername = document.getElementById("proUsername");
const proNickname = document.getElementById("proNickname");
const proBio = document.getElementById("proBio");

const postCount = document.getElementById("postCount");
const followerCount = document.getElementById("followerCount");
const followingCount = document.getElementById("followingCount");
const likeCount = document.getElementById("likeCount");
const followBtn = document.getElementById("followBtn");

/* MENU */
const btnPosts = document.getElementById("btnPosts");
const btnAddPost = document.getElementById("btnAddPost");
const btnCommunities = document.getElementById("btnCommunities");
const btnSettings = document.getElementById("btnSettings");
const profileSection = document.getElementById("profileSection");

/* PARAM */
const params = new URLSearchParams(location.search);
const profileUid = params.get("uid");

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "login_register.html";
    return;
  }

  myUid = user.uid;

  const params = new URLSearchParams(location.search);
  viewedUid = params.get("uid") || myUid;
  isMyProfile = viewedUid === myUid;

  console.log("My UID:", myUid);
  console.log("Viewed UID:", viewedUid);

  try {
    await loadUserProfile(viewedUid);
    initFollowSystem();
  } catch (err) {
    console.error("Gagal load profile:", err);
  }
});

async function loadUserProfile(uid) {

  const snap = await get(ref(db, `users/${uid}`));

  if (!snap.exists()) {
    console.warn("User tidak ditemukan:", uid);
    return;
  }

  const u = snap.val();

  proAvatar.src = u.avatar || "default-avatar.png";
  proUsername.textContent = u.username || "Pengguna";
  proNickname.textContent = "@" + (u.nickname || "user");
  proBio.textContent = u.bio || "Belum ada bio";

  await loadCounts(uid);
}

async function getPostsByUid(uid) {
  try {
    const snap = await get(query(ref(db, "posts"), orderByChild("uid"), equalTo(uid)));
    const items = [];
    if (snap.exists()) {
      snap.forEach(p => items.push({ id: p.key, data: p.val() }));
    }
    return items;
  } catch (err) {
    console.warn("Query by uid gagal, fallback ambil semua:", err);
    const snap = await get(ref(db, "posts"));
    const items = [];
    if (snap.exists()) {
      snap.forEach(p => {
        const d = p.val();
        if (d.uid === uid) items.push({ id: p.key, data: d });
      });
    }
    return items;
  }
}

async function loadCounts(uid) {
  // ===== POST & LIKE =====
  let postTotal = 0;
  let likeTotal = 0;

  const posts = await getPostsByUid(uid);
  posts.forEach(p => {
    postTotal++;
    if (p.data.likes) likeTotal += Object.keys(p.data.likes).length;
  });

  // ===== FRIENDS =====
  const friendSnap = await get(ref(db, `friends/${uid}`));
  const requestSnap = await get(ref(db, `friend_requests/${uid}`));

  const friendCount = friendSnap.exists()
    ? Object.keys(friendSnap.val()).length
    : 0;

  const requestCount = requestSnap.exists()
    ? Object.keys(requestSnap.val()).length
    : 0;

  postCount.textContent = postTotal;
  likeCount.textContent = likeTotal;

  // FOLLOWER = FRIEND + REQUEST
  followerCount.textContent = friendCount + requestCount;

  // FOLLOWING = FRIEND SAJA
  followingCount.textContent = friendCount;
}

/* ================= MENU HANDLER ================= */
function setActive(btn) {
  document.querySelectorAll(".menu-item").forEach(b =>
    b.classList.remove("active")
  );
  btn.classList.add("active");
}

function renderEmptyProfileContent() {
  const actionHtml = isMyProfile
    ? `<button class="empty-action" id="emptyAddPostBtn">Tambah postingan</button>`
    : "";

  profileSection.innerHTML = `
    <div class="empty-state">
      <p class="empty-text">Belum ada postingan dan media yang diupload</p>
      ${actionHtml}
    </div>
  `;

  if (isMyProfile) {
    const addBtn = document.getElementById("emptyAddPostBtn");
    if (addBtn) addBtn.onclick = () => btnAddPost.click();
  }
}

/* ================= LOAD POSTINGS ================= */
async function loadPostings(uid) {
  activeProfileView = "posts";
  setActive(btnPosts);
  profileSection.innerHTML = `
    <div class="content-loader">
      <div class="content-spinner"></div>
      <div>Memuat postingan...</div>
    </div>
  `;

  const posts = await getPostsByUid(uid);
  if (activeProfileView !== "posts") return;
  if (!posts.length) {
    renderEmptyProfileContent();
    return;
  }

  profileSection.innerHTML = "";
  let hasPost = false;

  posts.forEach(p => {
    if (activeProfileView !== "posts") return;
    const postId = p.id;
    const post = p.data;

    hasPost = true;

    const card = document.createElement("div");
    card.className = "post-card";

    const date = new Date(post.time || Date.now());
    const timeText = date.toLocaleDateString("id-ID");

    let imagesHTML = "";
    if (post.images && post.images.length) {
      imagesHTML = `
        <div class="post-images">
          ${Object.values(post.images).map(img => `<img src="${img}">`).join("")}
        </div>
      `;
    }

    const videoHTML = post.videoUrl
      ? `
        <div class="post-video">
          <video src="${post.videoUrl}" controls></video>
        </div>
      `
      : "";

    card.innerHTML = `
      <div class="post-header">
        <img src="${proAvatar.src}">
        <div class="post-user">
          <b>${proUsername.textContent}</b>
          <span>${timeText}</span>
        </div>
      </div>

      ${imagesHTML}
      ${videoHTML}

      <div class="post-actions">
        <span>Like ${post.likes ? Object.keys(post.likes).length : 0}</span>
        <span class="btn-comment" style="cursor:pointer">
          Comment ${post.comments ? Object.keys(post.comments).length : 0}
        </span>
      </div>

      <div class="post-text">
        ${post.text || ""}
      </div>

      <div class="comment-section" id="comment-${postId}">
        <div class="comment-list"></div>

        <div class="comment-input">
          <input type="text" placeholder="Tulis komentar...">
          <button>Kirim</button>
        </div>
      </div>
    `;

    /* ===== COMMENT TOGGLE ===== */
    const btnComment = card.querySelector(".btn-comment");
    const commentSection = card.querySelector(".comment-section");
    const commentList = card.querySelector(".comment-list");
    const input = card.querySelector("input");
    const sendBtn = card.querySelector("button");

    // 🔒 default hidden
    commentSection.style.display = "none";

    btnComment.onclick = async () => {
      const isOpen = commentSection.style.display === "block";
      commentSection.style.display = isOpen ? "none" : "block";

      if (!isOpen) {
        loadComments(postId, commentList);
      }
    };

    /* ===== SEND COMMENT ===== */
    sendBtn.onclick = async () => {
      if (!input.value.trim()) return;

      const user = auth.currentUser;
      if (!user) return;

    const snap = await get(ref(db, `users/${user.uid}`));
    const u = snap.val();

    await push(ref(db, `posts/${postId}/comments`), {
      uid: user.uid,
      username: u?.username || "Pengguna",
      avatar: u?.avatar || "default-avatar.png",
      text: input.value,
      time: Date.now()
    });

      input.value = "";
      loadComments(postId, commentList);
    };

    profileSection.appendChild(card);
  });

  if (!hasPost) {
    renderEmptyProfileContent();
  }
}

async function loadComments(postId, container) {
  if (!container) return;
  container.innerHTML = "";

  const snap = await get(ref(db, `posts/${postId}/comments`));
  if (!snap.exists()) {
    container.innerHTML = `<p class="empty-text">Belum ada komentar</p>`;
    return;
  }

  snap.forEach(c => {
    const data = c.val();

    const d = document.createElement("div");
    d.className = "comment-item";

    d.innerHTML = `
      <img src="${data.avatar || "default-avatar.png"}" class="comment-avatar">
      <div class="comment-body">
        <b onclick="goProfile('${data.uid}')" style="cursor:pointer">
          ${data.username || "Pengguna"}
        </b>
        <p>${data.text}</p>
      </div>
    `;

    container.appendChild(d);
  });
}

/* ================= MENU CLICK ================= */
btnPosts.onclick = () => loadPostings(profileUid || auth.currentUser.uid);

btnCommunities.onclick = () => loadCommunities(profileUid || auth.currentUser.uid);

btnSettings.onclick = () => {
  setActive(btnSettings);

  profileSection.innerHTML = `
    <div class="settings-wrap">

      <div class="settings-avatar">
        <label>
          <img id="setAvatar" src="${proAvatar.src}">
          <span>Ubah</span>
          <input type="file" id="avatarInput" accept="image/*" hidden>
        </label>
      </div>

      <div class="settings-form">
        <label>Username</label>
        <input id="setUsername" type="text" value="${proUsername.textContent}">

        <label>Nickname</label>
        <input id="setNickname" type="text" value="${proNickname.textContent.replace("@","")}">

        <label>Bio</label>
        <textarea id="setBio">${proBio.textContent}</textarea>

        <button id="saveProfile">Simpan Perubahan</button>
      </div>

    </div>
  `;

  initSettings();
};

function initSettings() {
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg = document.getElementById("setAvatar");
  const btnSave = document.getElementById("saveProfile");

  let avatarBase64 = null;

  avatarInput.onchange = () => {
    const file = avatarInput.files[0];
    if (!file) return;

    // batas aman 300KB
    if (file.size > 300 * 1024) {
      alert("Ukuran foto max 300KB");
      avatarInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      avatarBase64 = reader.result;
      avatarImg.src = avatarBase64;
    };
    reader.readAsDataURL(file);
  };

  btnSave.onclick = async () => {
    const user = auth.currentUser;
  if (!user) return;

    const username = document.getElementById("setUsername").value.trim();
    const nickname = document.getElementById("setNickname").value.trim();
    const bio = document.getElementById("setBio").value.trim();

    if (!username || !nickname) {
      alert("Username & Nickname wajib diisi");
      return;
    }

    const updates = {
      username,
      nickname,
      bio
    };

    if (avatarBase64) {
      updates.avatar = avatarBase64;
      proAvatar.src = avatarBase64;
    }

    await update(ref(db, `users/${user.uid}`), updates);

    proUsername.textContent = username;
    proNickname.textContent = "@" + nickname;
    proBio.textContent = bio;

    alert("Profil berhasil diperbarui");
  };
}

async function loadCommunities(uid) {
  setActive(btnCommunities);
  profileSection.innerHTML = `
    <div class="community-wrap">
      <h4>Komunitas Dibuat</h4>
      <div id="communityCreated" class="community-list">Memuat...</div>
    </div>
    <div class="community-wrap">
      <h4>Komunitas Diikuti</h4>
      <div id="communityJoined" class="community-list">Memuat...</div>
    </div>
  `;

  const [commSnap, memberSnap] = await Promise.all([
    get(ref(db, "communities")),
    get(ref(db, "community_members"))
  ]);

  const createdEl = document.getElementById("communityCreated");
  const joinedEl = document.getElementById("communityJoined");
  if (!createdEl || !joinedEl) return;

  if (!commSnap.exists()) {
    createdEl.innerHTML = `<div class="community-empty">Belum ada komunitas.</div>`;
    joinedEl.innerHTML = `<div class="community-empty">Belum mengikuti komunitas.</div>`;
    return;
  }

  const created = [];
  const joined = [];
  commSnap.forEach(c => {
    const data = c.val() || {};
    const isOwner = data.ownerId === uid;
    const isMember = memberSnap.exists()
      && memberSnap.child(c.key).child(uid).exists();
    if (isOwner) created.push({ id: c.key, data });
    if (isMember && !isOwner) joined.push({ id: c.key, data });
  });

  createdEl.innerHTML = created.length
    ? created.map(c => communityItemHtml(c)).join("")
    : `<div class="community-empty">Belum membuat komunitas.</div>`;

  joinedEl.innerHTML = joined.length
    ? joined.map(c => communityItemHtml(c)).join("")
    : `<div class="community-empty">Belum mengikuti komunitas.</div>`;
}

function communityItemHtml(c) {
  return `
    <div class="community-item">
      <img src="${c.data?.avatar || "default-avatar.png"}">
      <div>
        <b>${c.data?.name || "Komunitas"}</b>
        <small>${c.data?.category || "Umum"}</small>
      </div>
      <button class="community-open-btn" onclick="openCommunity('${c.id}')">Buka</button>
    </div>
  `;
}

window.openCommunity = id => {
  if (!id) return;
  location.href = `index.html?tab=community&communityId=${id}`;
};

async function loadFriendList(uid) {
  const list = document.getElementById("friendList");
  list.innerHTML = `<p class="empty-text">Memuat...</p>`;

  const snap = await get(ref(db, `friends/${uid}`));
  if (!snap.exists()) {
    list.innerHTML = `<p class="empty-text">Belum ada teman</p>`;
    return;
  }

  for (const friendId of Object.keys(snap.val())) {
    const userSnap = await get(ref(db, `users/${friendId}`));
    if (!userSnap.exists()) continue;

    const u = userSnap.val();

    const div = document.createElement("div");
    div.className = "friend-item";
    div.onclick = () => {
      location.href = `profile.html?uid=${friendId}`;
    };

    div.innerHTML = `
      <img src="${u.avatar || 'default-avatar.png'}">
      <div class="friend-info">
        <b>${u.username}</b>
        <span>@${u.nickname}</span>
      </div>
    `;

    list.appendChild(div);
  }
}

async function loadMedia(uid) {
  activeProfileView = "media";
  setActive(btnMedia);
  profileSection.innerHTML = `
    <div class="content-loader">
      <div class="content-spinner"></div>
      <div>Memuat media...</div>
    </div>
  `;

  const posts = await getPostsByUid(uid);
  if (activeProfileView !== "media") return;
  if (!posts.length) {
    renderEmptyProfileContent();
    return;
  }

  const mediaItems = [];
  posts.forEach(p => {
    if (activeProfileView !== "media") return;
    const post = p.data;

    if (post.images) {
      const images = Array.isArray(post.images)
        ? post.images
        : Object.values(post.images);
      images.forEach(img => mediaItems.push({ type: "image", src: img }));
    }
    if (post.videoUrl) {
      mediaItems.push({ type: "video", src: post.videoUrl });
    }
  });

  if (!mediaItems.length) {
    renderEmptyProfileContent();
    return;
  }

  profileSection.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "media-grid";

  mediaItems.forEach(m => {
    const item = document.createElement("div");
    item.className = "media-item";
    if (m.type === "image") {
      item.innerHTML = `<img src="${m.src}">`;
    } else {
      item.innerHTML = `<video src="${m.src}" controls></video>`;
    }
    wrap.appendChild(item);
  });

  profileSection.appendChild(wrap);
}

/* ================= SIMPLE FOLLOW SYSTEM ================= */

function initFollowRealtime(uid) {
  const followRef = ref(db, `follows/${myUid}/${uid}`);

  onValue(followRef, (snap) => {
    followBtn.className = "btn-add";

    if (snap.exists()) {
      followBtn.textContent = "Unfollow";
      followBtn.classList.add("danger");
    } else {
      followBtn.textContent = "Follow";
      followBtn.classList.add("primary");
    }
  });
}


async function toggleFollow(targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return;

  const followRef = ref(db, `follows/${myUid}/${targetUid}`);
  const snap = await get(followRef);

  if (snap.exists()) {
    // ===== UNFOLLOW =====
    await remove(followRef);
  } else {
    // ===== FOLLOW =====
    await set(followRef, true);
  }

  // refresh tombol setelah aksi
  updateFollowButton(targetUid);
}


async function updateFollowButton(uid) {
  if (!followBtn) return;

  const snap = await get(ref(db, `follows/${myUid}/${uid}`));

  followBtn.className = "btn-add"; // reset class

  if (snap.exists()) {
    followBtn.textContent = "Unfollow";
    followBtn.classList.add("danger");
  } else {
    followBtn.textContent = "Follow";
    followBtn.classList.add("primary");
  }
}


function initFollowCountRealtime(uid) {

  const followersRef = ref(db, "follows");
  const followingRef = ref(db, `follows/${uid}`);

  // FOLLOWING
  onValue(followingRef, snap => {
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    followingCount.textContent = count;
  });

  // FOLLOWERS
  onValue(followersRef, snap => {
    if (!snap.exists()) {
      followerCount.textContent = 0;
      return;
    }

    let total = 0;

    snap.forEach(userSnap => {
      if (userSnap.child(uid).exists()) total++;
    });

    followerCount.textContent = total;
  });
}

function initFollowSystem() {

  if (!followBtn) return;

  if (!isMyProfile) {

    followBtn.style.display = "inline-flex";
    followBtn.onclick = () => toggleFollow(viewedUid);

    updateFollowButton(viewedUid);
    initFollowRealtime(viewedUid);
    initFollowCountRealtime(viewedUid);

  } else {
    followBtn.style.display = "none";
    initFollowCountRealtime(myUid);
  }
}
