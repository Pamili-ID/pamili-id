/* ================= IMPORTS & FIREBASE CONFIG ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  push,
  update,
  remove,
  set,
  get,
  onDisconnect,
  onChildAdded,
  onChildChanged,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBnE8ZLTp58Orle6vu9Rk9xJMEajCPo7PQ",
  authDomain: "pamili-id.firebaseapp.com",
  projectId: "pamili-id",
  storageBucket: "pamili-id.appspot.com",
  messagingSenderId: "584922601978",
  appId: "1:584922601978:web:6b3f226bbc5af144bbac43"
};

/* ================= VARIABEL GLOBAL ================= */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let selectedImages = [];
let allPosts = [];
let activeChatFriend = null;
let recommendationCache = null;
let renderLimit = 10;
let lastRenderList = null;
let friendTabMode = "list";
let postsFirstLoad = false;
let dmFilterMode = "all";
let activeTab = "warkop";
let activeCommunityId = null;
let communitiesCache = null;
let communityAvatarDraft = "";
let communityAvatarEdit = "";
let communityDeepLinkHandled = false;
const pageParams = new URLSearchParams(location.search);
let communityView = "list";
let followSet = new Set();
let followSetReady = false;
let warkopOrder = [];



/* ================= ELEMENT SELECTORS ================= */
// Main containers
const feed = document.getElementById("feed");
const searchInput = document.getElementById("searchInput");
const friendList = document.getElementById("friendList");
const friendRequests = document.getElementById("friendRequests");
const recommendList = document.getElementById("recommendList");
const communityRequestList = document.getElementById("communityRequestList");

// Profile elements
const navAvatar = document.getElementById("navAvatar");
const navNickname = document.getElementById("navNickname");
const profileArea = document.getElementById("profileArea");
const profileMenu = document.getElementById("profileMenu");
const logoutBtn = document.getElementById("logoutBtn");

// Profile info (asumsi ada di HTML)
const proNickname = document.getElementById("proNickname");
const proUsername = document.getElementById("proUsername");
const proAvatar = document.getElementById("proAvatar");

// Post modal elements
const openPost = document.getElementById("openPost");
const closePost = document.getElementById("closePost");
const postModal = document.getElementById("postModal");
const postText = document.getElementById("postText");
const fileBtn = document.getElementById("fileBtn");
const fileInput = document.getElementById("fileInput");
const imagePreview = document.getElementById("imagePreview");
const previewRow = document.getElementById("previewRow"); // Asumsi ada di HTML
const previewImg = document.getElementById("previewImg");
const removeImage = document.getElementById("removeImage");
const submitPost = document.getElementById("submitPost");

// Feed tabs
const feedTabs = document.querySelectorAll(".feed-tabs button");

// Image modal
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");

/* ================= AUTH & USER PRESENCE ================= */
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "../frontend/login_register.html";
    return;
  }

  const userRef = ref(db, `users/${user.uid}`);
  const onlineRef = ref(db, `users/${user.uid}/online`);
  const lastSeenRef = ref(db, `users/${user.uid}/lastSeen`);
  const connectedRef = ref(db, ".info/connected");

  // Load user profile
  onValue(userRef, snap => {
    const u = snap.val();
    if (!u) return;
    
    navNickname.textContent = u.username || "Pengguna";
    navAvatar.src = u.avatar || "default-avatar.png";
    
    // Update profile info jika elemen ada
    if (proNickname) proNickname.textContent = u.username || "Pengguna";
    if (proUsername) proUsername.textContent = u.nickname || "pengguna";
    if (proAvatar) proAvatar.src = u.avatar || "default-avatar.png";
  }, { onlyOnce: true });

  // Presence system
  onValue(connectedRef, snap => {
    if (snap.val() === true) {
      set(onlineRef, true);
      onDisconnect(onlineRef).set(false);
      onDisconnect(lastSeenRef).set(Date.now());
    }
  });

  loadFriends(user.uid);
  loadRequests(user.uid);
  loadRecommendations(user.uid);
  watchFollowSet(user.uid);
  handleCommunityDeepLink();

});

/* ================= PROFILE DROPDOWN ================= */
profileArea.onclick = e => {
  e.stopPropagation();
  profileMenu.style.display =
    profileMenu.style.display === "flex" ? "none" : "flex";
};

document.onclick = () => profileMenu.style.display = "none";

logoutBtn.onclick = async () => {
  const user = auth.currentUser;
  if (user) {
    await set(ref(db, `users/${user.uid}/online`), false);
    await set(ref(db, `users/${user.uid}/lastSeen`), Date.now());
  }
  await signOut(auth);
  location.href = "login_register.html";
};

document.getElementById("myProfileBtn").onclick = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  location.href = `frontend/profile.html?uid=${uid}`;
};

/* ================= POST MODAL & IMAGE PREVIEW ================= */
openPost.onclick = () => postModal.style.display = "flex";
closePost.onclick = () => postModal.style.display = "none";
fileBtn.onclick = () => fileInput.click();

fileInput.onchange = () => {
  const files = Array.from(fileInput.files);

  for (const file of files) {
    if (selectedImages.length >= 10) {
      alert("Max 10 foto");
      break;
    }

    if (file.size > 2 * 1024 * 1024) continue;

    const reader = new FileReader();
    reader.onload = () => {
      selectedImages.push(reader.result);
      renderPreviewImages();
    };
    reader.readAsDataURL(file);
  }

  fileInput.value = "";
};

function renderPreviewImages() {
  if (!previewRow) return;
  
  previewRow.innerHTML = "";

  selectedImages.forEach((src, index) => {
    const wrap = document.createElement("div");
    wrap.className = "preview-item";

    const img = document.createElement("img");
    img.src = src;

    const del = document.createElement("button");
    del.innerHTML = "✕";
    del.className = "remove-img";
    del.onclick = () => {
      selectedImages.splice(index, 1);
      renderPreviewImages();
    };

    wrap.appendChild(img);
    wrap.appendChild(del);
    previewRow.appendChild(wrap);
  });

  imagePreview.style.display =
    selectedImages.length ? "block" : "none";
}

removeImage.onclick = () => {
  selectedImages = [];
  if (previewRow) previewRow.innerHTML = "";
  imagePreview.style.display = "none";
  fileInput.value = "";
};

submitPost.onclick = async () => {
  if (!postText.value && selectedImages.length === 0) {
    alert("Isi post");
    return;
  }

  const user = auth.currentUser;
  const snap = await get(ref(db, "users/" + user.uid));
  const u = snap.val();

  push(ref(db, "posts"), {
    uid: user.uid,
    username: u?.username || "Pengguna",
    avatar: u?.avatar || "default-avatar.png",
    text: postText.value || "",
    images: selectedImages,
    likes: {},
    time: Date.now()
  });

  postModal.style.display = "none";
  postText.value = "";
  selectedImages = [];
  if (previewRow) previewRow.innerHTML = "";
  imagePreview.style.display = "none";
};

/* ================= POSTS MANAGEMENT ================= */
onChildAdded(ref(db, "posts"), snap => {
  allPosts.unshift({ id: snap.key, ...snap.val() });

  renderCurrentTab();

  if (!postsFirstLoad) postsFirstLoad = true;

  warkopOrder = [];

});



onChildChanged(ref(db, "posts"), snap => {
  const idx = allPosts.findIndex(p => p.id === snap.key);
  if (idx === -1) return;

  allPosts[idx] = { id: snap.key, ...snap.val() };

  updateSinglePost(snap.key);
});


function renderCurrentTab() {
  if (activeTab === "warkop") {
    renderWarkop();
    return;
  }
  if (activeTab === "following") {
    renderFollowing();
  }
}

function renderPosts(list) {
  if (!feed) return;
  
  feed.innerHTML = "";

  if (lastRenderList !== list) {
    lastRenderList = list;
    renderLimit = 10;
  }

  const visible = list.slice(0, renderLimit);

  if (!visible.length && !postsFirstLoad) {
    renderFeedLoader("Memuat Warkop...");
    return;
  }
  if (!visible.length && postsFirstLoad) {
    feed.innerHTML = "<p>Belum ada postingan.</p>";
    return;
  }

  visible.forEach(p => {
   

    const liked = p.likes && p.likes[auth.currentUser?.uid];
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;
    const commentCount = p.comments ? Object.keys(p.comments).length : "";
    const isTrending = !!p._isTrending;

    const post = document.createElement("div");
    post.className = "post";
    post.setAttribute("data-id", p.id);



    const isMine = p.uid === auth.currentUser?.uid;

    post.innerHTML = `
  <div class="post-header">
    <div class="post-user">
      <img src="${p.avatar}" onclick="goProfile('${p.uid}')">
      <div>
        <b onclick="goProfile('${p.uid}')">${p.username}</b>
        ${isTrending ? `<span class="trend-badge">Trending</span>` : ""}
        <br>
        <small>${new Date(p.time).toLocaleString()}</small>
      </div>
    </div>

    ${
      p.uid === auth.currentUser?.uid
        ? `
        <div class="post-menu">
          <button class="menu-btn" onclick="togglePostMenu('${p.id}')">⋮</button>
          <div class="menu-dropdown" id="menu-${p.id}">
            <button class="danger" onclick="deletePost('${p.id}')">
              <span class="menu-ico">🗑</span>
              <span>Hapus postingan</span>
            </button>
          </div>
        </div>
        `
        : ""
    }
  </div>


  </div>


      ${p.images && p.images.length ? `
        <div class="post-gallery">
          ${p.images.map(img => `
            <img src="${img}">
          `).join("")}
        </div>
      ` : ""}

      ${p.videoUrl ? `
        <div class="post-video">
          <video src="${p.videoUrl}" controls></video>
        </div>
      ` : ""}

      <p>${p.text || ""}</p>

      <div class="post-actions">
        <div class="like-btn ${liked ? "active" : ""}" onclick="like('${p.id}')">
          ${liked ? "❤️" : "🤍"}
          <span class="count">${likeCount}</span>
        </div>

        <div class="comment-btn" onclick="toggleComment('${p.id}')">
          💬
          <span class="count">${commentCount}</span>
        </div>
      </div>

      <div class="comments" id="c-${p.id}"></div>
    `;

    feed.appendChild(post);
  });

  if (list.length > renderLimit) {
    const more = document.createElement("button");
    more.className = "load-more";
    more.textContent = "Muat lebih banyak";
    more.onclick = () => {
      renderLimit += 10;
      renderPosts(list);
    };
    feed.appendChild(more);
  }
}

function updateSinglePost(postId) {
  const postData = allPosts.find(p => p.id === postId);
  if (!postData) return;

  const postEl = document.querySelector(`.post[data-id="${postId}"]`);
  if (!postEl) return;

  const liked = postData.likes && postData.likes[auth.currentUser?.uid];
  const likeCount = postData.likes ? Object.keys(postData.likes).length : 0;
  const commentCount = postData.comments ? Object.keys(postData.comments).length : 0;

  const likeBtn = postEl.querySelector(".like-btn");
  const likeCountEl = postEl.querySelector(".like-btn .count");
  const commentCountEl = postEl.querySelector(".comment-btn .count");

  if (likeBtn) likeBtn.classList.toggle("active", liked);
  if (likeCountEl) likeCountEl.textContent = likeCount;
  if (commentCountEl) commentCountEl.textContent = commentCount;
}



/* ================= POST INTERACTIONS ================= */
window.goProfile = uid => {
  if (!uid) return;
  location.href = `../frontend/profile.html?uid=${uid}`;
};

window.like = id => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const r = ref(db, `posts/${id}/likes/${uid}`);
  onValue(r, s => s.exists() ? remove(r) : set(r, true), { onlyOnce: true });
  window.deletePost = async postId => {
  const user = auth.currentUser;
  if (!user) return;

  const postRef = ref(db, `posts/${postId}`);
  const snap = await get(postRef);

  if (!snap.exists()) return;

  // 🔒 
  if (snap.val().uid !== user.uid) {
    alert("Kamu tidak punya izin menghapus postingan ini");
    return;
  }

  if (!confirm("Yakin ingin menghapus postingan ini?")) return;

  await remove(postRef);
};

};

/* ================= COMMENTS SYSTEM ================= */
const openComments = {};

window.toggleComment = id => {
  const box = document.getElementById("c-" + id);
  if (!box) return;
  
  if (openComments[id]) {
    box.innerHTML = "";
    openComments[id] = false;
    return;
  }
  
  openComments[id] = true;
  box.innerHTML = `
    <div class="comment-list" id="list-${id}"></div>
    <div class="comment-input">
      <div class="comment-input-inner">
        <img src="${navAvatar.src}" class="comment-input-avatar">
        <textarea 
          id="i-${id}" 
          placeholder="Tulis komentar..."
          rows="1"
          oninput="autoGrow(this)"
          onkeydown="handleCommentKey(event, '${id}')"
        ></textarea>
        <button onclick="send('${id}')" class="send-btn">➤</button>
      </div>
    </div>
  `;
  
  onValue(ref(db, `posts/${id}/comments`), snap => {
    const list = document.getElementById("list-" + id);
    if (!list) return;
    
    list.innerHTML = "";
    snap.forEach(c => {
      const data = c.val();
      const d = document.createElement("div");
      d.className = "comment-item";
      
      const username = data.username || "Pengguna";
      const avatar = data.avatar || "default-avatar.png";
      const uid = data.uid || "";
      const time = data.time ? timeAgo(data.time) : "";
      
      d.innerHTML = `
        <div class="comment-header">
          <div class="comment-user" onclick="${uid ? `goProfile('${uid}')` : ""}">
            <img src="${avatar}" class="comment-avatar">
            <b>${username}</b>
            <small class="comment-time">${time}</small>
          </div>
        </div>
        <div class="comment-text">${data.text}</div>
      `;
      list.appendChild(d);
    });
  });
};

window.send = async id => {
  const input = document.getElementById("i-" + id);
  if (!input || !input.value.trim()) return;
  
  const user = auth.currentUser;
  if (!user) return;
  
  const snap = await get(ref(db, "users/" + user.uid));
  const u = snap.val();
  
  push(ref(db, `posts/${id}/comments`), {
    uid: user.uid,
    username: u?.username || "Pengguna",
    avatar: u?.avatar || "default-avatar.png",
    text: input.value,
    time: Date.now()
  });
  
  input.value = "";
};

/* ================= IMAGE MODAL & ZOOM ================= */
let zoomed = false;

feed.addEventListener("click", e => {
  if (e.target.tagName === "IMG" && e.target.closest(".post-gallery")) {
    imageModalImg.src = e.target.src;
    imageModal.style.display = "flex";
    zoomed = false;
    imageModalImg.style.transform = "scale(1)";
    imageModalImg.style.cursor = "zoom-in";
  }
});

imageModalImg.addEventListener("click", e => {
  e.stopPropagation();
  zoomed = !zoomed;
  if (zoomed) {
    imageModalImg.style.transform = `scale(2)`;
    imageModalImg.style.cursor = "zoom-out";
  } else {
    imageModalImg.style.transform = `scale(1)`;
    imageModalImg.style.cursor = "zoom-in";
  }
});

imageModal.addEventListener("click", () => {
  imageModal.style.display = "none";
});

/* ================= FRIENDS SYSTEM ================= */
window.addFriend = (targetUid, btn) => {
  const myUid = auth.currentUser?.uid;
  if (!myUid || myUid === targetUid) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Diikuti";
  }
  set(ref(db, `friend_requests/${targetUid}/${myUid}`), true)
    .then(() => {
      showToast("Request pertemanan terkirim");
      recommendationCache = null;
      loadRecommendations(myUid);
    })
    .catch(() => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Tambah";
      }
      alert("Gagal mengirim request. Coba lagi.");
    });
};

window.acceptFriend = senderUid => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  
  const updates = {};
  updates[`friends/${myUid}/${senderUid}`] = true;
  updates[`friends/${senderUid}/${myUid}`] = true;
  updates[`friend_requests/${myUid}/${senderUid}`] = null;
  
  update(ref(db), updates);
};

function loadFriends(myUid) {
  if (!friendList) return;
  
  onValue(ref(db, "friends/" + myUid), snap => {
    friendList.innerHTML = "";
    
    if (!snap.exists()) {
      friendList.innerHTML = "<small>Belum ada teman</small>";
      return;
    }

    const fetches = [];
    snap.forEach(f => {
      fetches.push(
        get(ref(db, "users/" + f.key)).then(s => ({
          uid: f.key,
          data: s.val()
        }))
      );
    });

    Promise.all(fetches).then(items => {
      const list = items
        .filter(i => i.data)
        .sort((a, b) => {
          const ao = a.data.online ? 1 : 0;
          const bo = b.data.online ? 1 : 0;
          if (bo !== ao) return bo - ao;
          const al = a.data.lastSeen || 0;
          const bl = b.data.lastSeen || 0;
          if (bl !== al) return bl - al;
          const an = (a.data.username || "").toLowerCase();
          const bn = (b.data.username || "").toLowerCase();
          return an.localeCompare(bn);
        });

      list.forEach(item => {
        const u = item.data;
        const d = document.createElement("div");
        d.className = "friend";
        d.innerHTML = `
          <img src="${u.avatar || "default-avatar.png"}">
          <span>${u.username || "Pengguna"}</span>
          <small class="${u.online ? "on" : "off"}">
            ${u.online ? "Online" : `Terakhir ${timeAgo(u.lastSeen)}`}
          </small>
        `;

        friendList.appendChild(d);

        d.onclick = () => {
          activeChatFriend = item.uid;
          friendTabMode = "chat";
          document.querySelectorAll("#friendList .friend").forEach(fr => 
            fr.classList.remove("active-friend")
          );
          d.classList.add("active-friend");
          feedTabs.forEach(t => t.classList.remove("active"));
          feedTabs[2].classList.add("active");
          renderChat(item.uid);
        };
      });
    });
  });
}

function loadRequests(myUid) {
  if (!friendRequests) return;
  
  onValue(ref(db, "friend_requests/" + myUid), snap => {
    friendRequests.innerHTML = "";
    
    snap.forEach(r => {
      onValue(ref(db, "users/" + r.key), s => {
        const u = s.val();
        friendRequests.innerHTML += `
          <div class="friend">
            <img src="${u.avatar || "default-avatar.png"}">
            <span>${u.username}</span>
            <button class="accept-btn" onclick="acceptFriend('${r.key}')">Ikuti balik</button>
          </div>
        `;
      }, { onlyOnce: true });
    });
  });
}

async function loadRecommendations(myUid) {
  if (!recommendList) return;

  if (recommendationCache) {
    renderRecommendationList(recommendationCache, myUid);
    return;
  }

  recommendList.innerHTML = "<small>Memuat rekomendasi...</small>";

  const [usersSnap, friendsSnap, requestsSnap] = await Promise.all([
    get(ref(db, "users")),
    get(ref(db, "friends")),
    get(ref(db, "friend_requests"))
  ]);

  recommendationCache = { usersSnap, friendsSnap, requestsSnap };
  renderRecommendationList(recommendationCache, myUid);
}

function renderRecommendationList(cache, myUid) {
  if (!recommendList) return;

  const { usersSnap, friendsSnap, requestsSnap } = cache;
  if (!usersSnap.exists()) {
    recommendList.innerHTML = "<small>Belum ada pengguna</small>";
    return;
  }

  const friendsOfMe = friendsSnap.exists() && friendsSnap.child(myUid).exists()
    ? friendsSnap.child(myUid).val()
    : {};
  const outgoingSet = new Set();
  if (requestsSnap && requestsSnap.exists()) {
    requestsSnap.forEach(r => {
      if (r.child(myUid).exists()) outgoingSet.add(r.key);
    });
  }

  const candidates = [];
  usersSnap.forEach(u => {
    const uid = u.key;
    if (uid === myUid) return;
    if (friendsOfMe && friendsOfMe[uid]) return;

    const data = u.val() || {};
    const followers = friendsSnap.exists() && friendsSnap.child(uid).exists()
      ? Object.keys(friendsSnap.child(uid).val() || {}).length
      : 0;

    const score = followers * 3 + (data.online ? 1 : 0);
    candidates.push({ uid, data, followers, score, isRequested: outgoingSet.has(uid) });
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const al = a.data.lastSeen || 0;
    const bl = b.data.lastSeen || 0;
    return bl - al;
  });

  const top = candidates.slice(0, 6);
  recommendList.innerHTML = "";

  if (!top.length) {
    recommendList.innerHTML = "<small>Tidak ada rekomendasi</small>";
    return;
  }

  top.forEach(item => {
    const u = item.data;
    const d = document.createElement("div");
    d.className = "friend recommend";
    d.innerHTML = `
      <img src="${u.avatar || "default-avatar.png"}">
      <div class="friend-meta">
        <span>${u.username || "Pengguna"}</span>
        <small>${item.followers} pengikut</small>
      </div>
      ${
        item.isRequested
          ? `<button class="add-btn" disabled>Diikuti</button>`
          : `<button class="add-btn" onclick="addFriend('${item.uid}', this)">Ikuti</button>`
      }
    `;
    recommendList.appendChild(d);
  });
}

/* ================= CHAT SYSTEM ================= */
async function renderChat(friendUid) {
  if (!feed) return;

  const chatPane = document.getElementById("dmChatPane");
  const target = chatPane || feed;
  const snap = await get(ref(db, "users/" + friendUid));
  const friend = snap.val();

  target.innerHTML = `
    <div class="chat-toolbar">
      <button class="ghost-btn dm-back" id="backToFriends">← Kembali</button>
      <span class="chat-title">Chat</span>
    </div>
    <div class="chat-header">
      <img src="${friend?.avatar || "default-avatar.png"}" class="chat-header-avatar">
      <div class="chat-header-info">
        <b>${friend?.username || "Teman"}</b>
        <small class="${friend?.online ? "on" : "off"}">
          ${friend?.online ? "Online" : `Terakhir ${timeAgo(friend?.lastSeen)}`}
        </small>
      </div>
    </div>
    <div class="chat-messages" id="chatMessages"></div>
    <div class="chat-input">
      <textarea
        id="chatInput"
        placeholder="Tulis pesan..."
        rows="1"
        oninput="autoGrow(this)"
        onkeydown="handleChatKey(event, '${friendUid}')"
      ></textarea>
      <button onclick="sendChat('${friendUid}')">➤</button>
    </div>
  `;

  const backBtn = document.getElementById("backToFriends");
  if (backBtn) {
    backBtn.onclick = () => {
      friendTabMode = "list";
      const dmPage = document.querySelector(".dm-page");
      if (dmPage) dmPage.classList.remove("dm-show-chat");
      if (!chatPane) {
        feedTabs.forEach(t => t.classList.remove("active"));
        feedTabs[2].classList.add("active");
        renderFriendsTab();
      }
    };
  }

  const dmPage = document.querySelector(".dm-page");
  if (dmPage) dmPage.classList.add("dm-show-chat");

  const chatRef = ref(db, `chats/${auth.currentUser.uid}_${friendUid}`);
  onValue(chatRef, snap => {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;
    
    chatMessages.innerHTML = "";
    snap.forEach(c => {
      const data = c.val();
      const isMe = data.uid === auth.currentUser.uid;

      const msg = document.createElement("div");
      msg.className = `chat-bubble ${isMe ? "me" : "them"}`;

      msg.innerHTML = `
        <img src="${data.avatar || "default-avatar.png"}" class="chat-avatar">
        <div class="chat-content">
          <b>${data.username}</b>
          <p>${data.text}</p>
        </div>
      `;

      chatMessages.appendChild(msg);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

window.sendChat = async friendUid => {
  const input = document.getElementById("chatInput");
  if (!input || !input.value.trim()) return;

  const user = auth.currentUser;
  if (!user) return;

  const snap = await get(ref(db, `users/${user.uid}`));
  const u = snap.val();

  const msg = {
    uid: user.uid,
    username: u?.username || "Pengguna",
    avatar: u?.avatar || "default-avatar.png",
    text: input.value,
    time: Date.now()
  };

  push(ref(db, `chats/${user.uid}_${friendUid}`), msg);
  push(ref(db, `chats/${friendUid}_${user.uid}`), msg);

  input.value = "";
};

window.handleChatKey = (e, friendUid) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat(friendUid);
  }
};

/* ================= SEARCH FUNCTIONALITY ================= */
if (searchInput) {
  searchInput.oninput = () => {
    const q = searchInput.value.toLowerCase();
    renderPosts(allPosts.filter(p => 
      p.text.toLowerCase().includes(q) || 
      p.username.toLowerCase().includes(q)
    ));
  };
}

/* ================= FEED TABS ================= */
feedTabs.forEach((tab, idx) => {
  tab.onclick = () => {
    feedTabs.forEach(t => t.classList.remove("active"));  
    tab.classList.add("active");
    
    if (idx === 0) {
      activeTab = "warkop";
      renderWarkop();
    } else if (idx === 1) {
      activeTab = "following";
      renderFollowing();
    } else if (idx === 2) {
      activeTab = "friends";
      if (friendTabMode === "chat" && activeChatFriend) {
        renderFriendsTab();
        renderChat(activeChatFriend);
      } else if (friendTabMode === "explore") {
        renderFriendsExploreTab();
      } else {
        friendTabMode = "list";
        renderFriendsTab();
      }
    } else if (idx === 3) {
      activeTab = "teams";
      renderCommunitiesTab();
    }
  };
});

function getTrendingIds(posts) {
  if (!posts.length) return new Set();
  const count = Math.max(3, Math.min(10, Math.ceil(posts.length * 0.1)));
  const last24h = Date.now() - 24 * 60 * 60 * 1000;
  const scored = posts.map(p => {
    const likeCount = p.likes ? Object.keys(p.likes).length : 0;
    const recent = p.time && p.time >= last24h ? 1 : 0;
    return { id: p.id, score: likeCount * 3 + recent };
  });
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  return new Set(top.map(i => i.id));
}

function renderWarkop() {
  if (!feed) return;

  if (!allPosts.length) {
    renderFeedLoader("Memuat Warkop...");
    return;
  }

  // Kalau belum ada urutan random, buat sekali
  if (!warkopOrder.length) {
    warkopOrder = [...allPosts]
      .sort(() => Math.random() - 0.5)
      .map(p => p.id);
  }

  const trendingIds = getTrendingIds(allPosts);

  const orderedPosts = warkopOrder
    .map(id => allPosts.find(p => p.id === id))
    .filter(Boolean)
    .map(p => ({ ...p, _isTrending: trendingIds.has(p.id) }));

  renderPosts(orderedPosts);
}

function renderFollowing() {
  if (!feed) return;

  if (!allPosts.length) {
    renderFeedLoader("Memuat Diikuti...");
    return;
  }

  const myUid = auth.currentUser?.uid;
  if (!myUid) return;

  const trendingIds = getTrendingIds(allPosts);

  const filtered = allPosts
    .filter(p => followSet.has(p.uid))
    .sort((a, b) => b.time - a.time) // terbaru di atas
    .map(p => ({ ...p, _isTrending: trendingIds.has(p.id) }));

  if (!filtered.length) {
    feed.innerHTML = "<p>Belum ada postingan dari yang diikuti.</p>";
    return;
  }

  renderPosts(filtered);
}


function watchFollowSet(myUid) {
  if (!myUid) return;
  const set = new Set();

  onValue(ref(db, "friends/" + myUid), snap => {
    set.clear();
    if (snap.exists()) {
      Object.keys(snap.val() || {}).forEach(uid => set.add(uid));
    }
    followSet = new Set(set);
    followSetReady = true;
    if (activeTab === "following") renderFollowing();
  });

  onValue(ref(db, "friend_requests"), snap => {
    if (snap.exists()) {
      snap.forEach(r => {
        if (r.child(myUid).exists()) set.add(r.key);
      });
    }
    followSet = new Set(set);
    followSetReady = true;
    if (activeTab === "following") renderFollowing();
  });
}
// community tab
function renderCommunitiesTab() {
  if (!feed) return;

  feed.innerHTML = `
    <div class="community-hero">
      <div class="community-hero-left">
        <h3>Komunitas</h3>
        <p>Ngobrol rame bareng komunitas. Bisa sharing teks & gambar!</p>
      </div>
      <button class="community-cta" id="openCommunityCreate">Buat Komunitas</button>
    </div>
    <div class="community-modal" id="communityModal">
      <div class="community-modal-card">
        <div class="community-modal-header">
          <h4>Buat Komunitas</h4>
          <button class="ghost-btn" id="closeCommunityModal">✕</button>
        </div>
        <div class="community-form">
          <label>Nama</label>
          <input id="communityName" type="text" placeholder="Nama komunitas">
          <label>Deskripsi</label>
          <textarea id="communityDesc" placeholder="Deskripsi singkat"></textarea>
          <label>Foto Komunitas</label>
          <div class="community-avatar-row">
            <img id="communityAvatarPreview" src="default-avatar.png" class="community-avatar-preview">
            <button class="ghost-btn" id="communityAvatarBtn">Pilih Foto</button>
            <input id="communityAvatarInput" type="file" accept="image/*" hidden>
          </div>
          <label>Kategori</label>
          <select id="communityCategory">
            <option>Keluarga</option>
            <option>Hobi</option>
            <option>Belajar</option>
            <option>Komunitas</option>
            <option>Lainnya</option>
          </select>
          <div class="community-category-add">
            <input id="communityCategoryNew" type="text" placeholder="Tambah kategori baru">
            <button class="ghost-btn" id="addCommunityCategory">Tambah</button>
          </div>
          <label>Visibilitas</label>
          <select id="communityVisibility">
            <option value="public">Publik</option>
            <option value="private">Private</option>
          </select>
          <button id="createCommunityBtn" class="community-cta">Buat</button>
          <small class="form-note">Private butuh persetujuan admin untuk masuk.</small>
        </div>
      </div>
    </div>
    <div class="community-toolbar">
      <input id="communitySearchInput" class="community-search" placeholder="Cari komunitas...">
      <div class="community-chips">
        <button class="chip active" data-filter="all">Semua</button>
        <button class="chip" data-filter="my">Komunitas Kamu</button>
        <button class="chip" data-filter="public">Publik</button>
        <button class="chip" data-filter="private">Private</button>
      </div>
    </div>
    <div class="community-layout">
      <div id="communityListWrap">
        <div class="community-section">
          <h4>Daftar Komunitas</h4>
          <div id="communityList" class="community-list">
            <div class="community-empty">Memuat komunitas...</div>
          </div>
        </div>
      </div>
      <div id="communityDetail" class="community-detail hidden">
        <div class="community-empty">Pilih komunitas untuk membuka chat.</div>
      </div>
    </div>
  `;

  loadCommunities();

  const search = document.getElementById("communitySearchInput");
  if (search) search.oninput = () => renderCommunityList();

  const chips = document.querySelectorAll(".community-chips .chip");
  chips.forEach(c => {
    c.onclick = () => {
      chips.forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      renderCommunityList();
    };
  });

  const openCreate = document.getElementById("openCommunityCreate");
  if (openCreate) openCreate.onclick = () => openCommunityModal();
}

function handleCommunityDeepLink() {
  if (communityDeepLinkHandled) return;
  const tab = (pageParams.get("tab") || "").toLowerCase();
  const communityId = pageParams.get("communityId");
  if (tab !== "community" && tab !== "komunitas") return;

  communityDeepLinkHandled = true;
  activeTab = "teams";
  feedTabs.forEach(t => t.classList.remove("active"));
  if (feedTabs[3]) feedTabs[3].classList.add("active");
  renderCommunitiesTab();
  if (communityId) {
    renderCommunityDetail(communityId);
  }
}

const COMMUNITY_CACHE_KEY = "pamili_community_cache_v1";
const COMMUNITY_CACHE_TTL = 2 * 60 * 1000;

function loadCommunityCache() {
  try {
    const raw = localStorage.getItem(COMMUNITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.ts || !parsed.data) return null;
    if (Date.now() - parsed.ts > COMMUNITY_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCommunityCache(data) {
  try {
    localStorage.setItem(
      COMMUNITY_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {}
}

async function loadCommunities() {
  const listEl = document.getElementById("communityList");
  if (!listEl) return;

  const cached = loadCommunityCache();
  if (cached) {
    communitiesCache = cached;
    renderCommunityList();
  }

  const myUid = auth.currentUser?.uid;
  if (!myUid) return;

  listEl.innerHTML = `<div class="community-empty">Memuat komunitas...</div>`;

  const [communitiesSnap, membersSnap] = await Promise.all([
    get(ref(db, "communities")),
    get(ref(db, "community_members"))
  ]);

  const communities = [];
  if (communitiesSnap.exists()) {
    communitiesSnap.forEach(c => {
      const data = c.val();
      communities.push({ id: c.key, data });
    });
  }

  const membership = {};
  if (membersSnap.exists()) {
    membersSnap.forEach(c => {
      const commId = c.key;
      const member = c.child(myUid);
      if (member.exists()) {
        membership[commId] = member.val();
      }
    });
  }

  communitiesCache = { communities, membership };
  saveCommunityCache(communitiesCache);
  renderCommunityList();
}

function renderCommunityList() {
  const listEl = document.getElementById("communityList");
  if (!listEl || !communitiesCache) return;

  const search = document.getElementById("communitySearchInput");
  const q = search ? search.value.toLowerCase() : "";
  const activeChip = document.querySelector(".community-chips .chip.active");
  const filter = activeChip ? activeChip.dataset.filter : "all";

  const { communities, membership } = communitiesCache;
  let items = communities.filter(c => {
    const name = (c.data?.name || "").toLowerCase();
    const cat = (c.data?.category || "").toLowerCase();
    const passSearch = !q || name.includes(q) || cat.includes(q);
    if (!passSearch) return false;
    if (filter === "my") return !!membership[c.id];
    if (filter === "public") return c.data?.visibility === "public";
    if (filter === "private") return c.data?.visibility === "private";
    return true;
  });

  if (!items.length) {
    listEl.innerHTML = `<div class="community-empty">Tidak ada komunitas cocok.</div>`;
    return;
  }

  listEl.innerHTML = "";
  items.forEach(c => {
    const isMember = !!membership[c.id];
    const visibility = c.data?.visibility || "public";
    const card = document.createElement("div");
    card.className = "community-card";
    card.innerHTML = `
      <div class="community-card-main">
        <img class="community-avatar-img" src="${c.data?.avatar || "default-avatar.png"}">
        <div>
          <h5>${c.data?.name || "Komunitas"}</h5>
          <small>${c.data?.category || "Umum"} • ${c.data?.visibility || "public"}</small>
        </div>
      </div>
      <div class="community-card-actions">
        ${
          isMember
            ? `<button class="ghost-btn" data-action="open" data-id="${c.id}">Lihat</button>`
            : `
              <button class="community-cta" data-action="join" data-id="${c.id}">Gabung</button>
              <button class="ghost-btn" data-action="open" data-id="${c.id}">Lihat</button>
            `
        }
      </div>
    `;

    card.querySelectorAll("button").forEach(btn => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      btn.onclick = () => {
        if (!id) return;
        if (action === "join") {
          requestJoinCommunity(id, visibility);
          return;
        }
        renderCommunityDetail(id);
      };
    });
    listEl.appendChild(card);
  });
}

function openCommunityModal() {
  const modal = document.getElementById("communityModal");
  if (!modal) return;
  modal.classList.add("show");
  communityAvatarDraft = "";
  const avatarPreviewEl = document.getElementById("communityAvatarPreview");
  if (avatarPreviewEl) avatarPreviewEl.src = "default-avatar.png";

  const closeBtn = document.getElementById("closeCommunityModal");
  if (closeBtn) closeBtn.onclick = () => closeCommunityModal();

  const addCatBtn = document.getElementById("addCommunityCategory");
  if (addCatBtn) {
    addCatBtn.onclick = () => {
      const input = document.getElementById("communityCategoryNew");
      const select = document.getElementById("communityCategory");
      const val = input?.value.trim();
      if (!val || !select) return;
      const opt = document.createElement("option");
      opt.textContent = val;
      select.appendChild(opt);
      select.value = val;
      input.value = "";
    };
  }

  const createBtn = document.getElementById("createCommunityBtn");
  if (createBtn) createBtn.onclick = () => createCommunity();

  const avatarBtn = document.getElementById("communityAvatarBtn");
  const avatarInput = document.getElementById("communityAvatarInput");
  const avatarPreviewEl2 = document.getElementById("communityAvatarPreview");
  if (avatarBtn && avatarInput && avatarPreviewEl2) {
    avatarBtn.onclick = () => avatarInput.click();
    avatarInput.onchange = async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (file.size > 200 * 1024) {
        alert("Ukuran foto maksimal 200KB.");
        avatarInput.value = "";
        return;
      }
      communityAvatarDraft = await fileToDataUrl(file);
      avatarPreviewEl2.src = communityAvatarDraft;
    };
  }
}

function closeCommunityModal() {
  const modal = document.getElementById("communityModal");
  if (modal) modal.classList.remove("show");
}

async function createCommunity() {
  const nameEl = document.getElementById("communityName");
  const descEl = document.getElementById("communityDesc");
  const catEl = document.getElementById("communityCategory");
  const catNewEl = document.getElementById("communityCategoryNew");
  const visEl = document.getElementById("communityVisibility");

  const name = nameEl?.value.trim();
  if (!name) {
    alert("Nama komunitas wajib diisi.");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const customCategory = catNewEl?.value.trim();
  const categoryValue = customCategory || catEl?.value || "Umum";

  const newRef = push(ref(db, "communities"));
  await set(newRef, {
    name,
    desc: descEl?.value.trim() || "",
    ownerId: user.uid,
    createdAt: Date.now(),
    category: categoryValue,
    visibility: visEl?.value || "public",
    avatar: communityAvatarDraft || "default-avatar.png"
  });

  await set(ref(db, `community_members/${newRef.key}/${user.uid}`), {
    role: "owner",
    joinedAt: Date.now()
  });

  loadCommunities();
  closeCommunityModal();
  renderCommunityDetail(newRef.key);
}

async function renderCommunityDetail(communityId) {
  const detail = document.getElementById("communityDetail");
  if (!detail) return;
  activeCommunityId = communityId;
  communityView = "detail";
  toggleCommunityView();

  detail.innerHTML = `<div class="community-empty">Memuat komunitas...</div>`;

  const [commSnap, memberSnap, reqSnap] = await Promise.all([
    get(ref(db, `communities/${communityId}`)),
    get(ref(db, `community_members/${communityId}`)),
    get(ref(db, `community_join_requests/${communityId}`))
  ]);

  if (!commSnap.exists()) {
    detail.innerHTML = `<div class="community-empty">Komunitas tidak ditemukan.</div>`;
    return;
  }

  const comm = { id: communityId, ...commSnap.val() };
  const myUid = auth.currentUser?.uid;
  const myMember = memberSnap.exists() && memberSnap.child(myUid).exists()
    ? memberSnap.child(myUid).val()
    : null;

  const isMember = !!myMember;
  const isOwner = myMember?.role === "owner";
  const isAdmin = isOwner || myMember?.role === "admin";

  detail.innerHTML = `
    <div class="community-header">
      <div class="community-header-main">
        <img src="${comm.avatar || "default-avatar.png"}" class="community-header-avatar">
        <div>
          <h4>${comm.name}</h4>
          <small>${comm.category || "Umum"} • ${comm.visibility || "public"}</small>
        </div>
      </div>
      <div class="community-header-actions" id="communityHeaderActions">
        <button class="ghost-btn" id="communityBackBtn">← Kembali</button>
      </div>
    </div>
    <div class="community-body">
      ${
        isMember
          ? `
            <div class="community-chat" id="communityChat">
              <div class="community-messages" id="communityMessages"></div>
              <div class="community-input">
                <input type="file" id="communityImage" accept="image/*" hidden>
                <button class="ghost-btn" id="communityImageBtn">🖼</button>
                <textarea id="communityText" rows="1" placeholder="Tulis pesan..."></textarea>
                <button class="community-cta" id="communitySendBtn">Kirim</button>
              </div>
            </div>
          `
          : `<div class="community-empty">Kamu belum menjadi anggota komunitas ini.</div>`
      }
    </div>
  `;

  const actions = document.getElementById("communityHeaderActions");
  if (actions) {
    if (isMember) {
      actions.innerHTML = `
        <button class="ghost-btn" id="communityBackBtn">← Kembali</button>
        ${isAdmin ? `<button class="ghost-btn" id="openCommunitySettings">⚙️ Settings</button>` : ""}
        ${isOwner ? `<button class="ghost-btn" id="deleteCommunityBtn">🗑 Hapus</button>` : ""}
        <button class="ghost-btn" id="leaveCommunityBtn">Keluar</button>
      `;
      const leaveBtn = document.getElementById("leaveCommunityBtn");
      if (leaveBtn) leaveBtn.onclick = () => leaveCommunity(communityId);
      const settingsBtn = document.getElementById("openCommunitySettings");
      if (settingsBtn) settingsBtn.onclick = () => openCommunitySettings(comm);
      const deleteBtn = document.getElementById("deleteCommunityBtn");
      if (deleteBtn) deleteBtn.onclick = () => deleteCommunity(communityId);
    } else {
      actions.innerHTML = `
        <button class="ghost-btn" id="communityBackBtn">← Kembali</button>
        <button class="community-cta" id="joinCommunityBtn">Gabung</button>
      `;
      const joinBtn = document.getElementById("joinCommunityBtn");
      if (joinBtn) joinBtn.onclick = () => requestJoinCommunity(communityId, comm.visibility);
    }
  }

  const backBtn = document.getElementById("communityBackBtn");
  if (backBtn) backBtn.onclick = () => {
    communityView = "list";
    toggleCommunityView();
  };

  if (isMember) {
    bindCommunityChat(communityId);
  }
  renderCommunityRequestsSidebar(communityId, reqSnap, isAdmin);
}

function toggleCommunityView() {
  const listWrap = document.getElementById("communityListWrap");
  const detail = document.getElementById("communityDetail");
  const layout = document.querySelector(".community-layout");
  if (!listWrap || !detail) return;
  if (communityView === "detail") {
    listWrap.classList.add("hidden");
    detail.classList.remove("hidden");
    if (layout) layout.classList.add("community-detail-open");
  } else {
    listWrap.classList.remove("hidden");
    detail.classList.add("hidden");
    if (layout) layout.classList.remove("community-detail-open");
  }
}

function openCommunitySettings(comm) {
  const detail = document.getElementById("communityDetail");
  if (!detail) return;
  communityAvatarEdit = comm.avatar || "default-avatar.png";
  const isOwner = auth.currentUser?.uid === comm.ownerId;
  const categoryOptions = ["Keluarga", "Hobi", "Belajar", "Komunitas", "Lainnya"];
  const categorySet = new Set(categoryOptions);
  if (comm.category && !categorySet.has(comm.category)) {
    categoryOptions.push(comm.category);
  }
  detail.innerHTML = `
    <div class="community-form">
      <h4>Settings Komunitas</h4>
      <label>Nama</label>
      <input id="communitySetName" type="text" value="${comm.name || ""}">
      <label>Deskripsi</label>
      <textarea id="communitySetDesc">${comm.desc || ""}</textarea>
      <label>Foto Komunitas</label>
      <div class="community-avatar-row">
        <img id="communitySetAvatarPreview" src="${communityAvatarEdit}" class="community-avatar-preview">
        <button class="ghost-btn" id="communitySetAvatarBtn">Ganti Foto</button>
        <input id="communitySetAvatarInput" type="file" accept="image/*" hidden>
      </div>
      <label>Kategori</label>
      <select id="communitySetCategory">
        ${categoryOptions.map(c => `<option ${comm.category === c ? "selected" : ""}>${c}</option>`).join("")}
      </select>
      <label>Visibilitas</label>
      <select id="communitySetVisibility">
        <option value="public" ${comm.visibility === "public" ? "selected" : ""}>Publik</option>
        <option value="private" ${comm.visibility === "private" ? "selected" : ""}>Private</option>
      </select>
      <button id="saveCommunitySettings" class="community-cta">Simpan</button>
      ${isOwner ? `<button id="deleteCommunitySettings" class="ghost-btn">🗑 Hapus Komunitas</button>` : ""}
      <button id="backCommunityDetail" class="ghost-btn">Kembali</button>
    </div>
    <div class="community-admin">
      <h4>Anggota</h4>
      <div id="communityAdminMembers" class="community-admin-list">Memuat anggota...</div>
    </div>
  `;

  const avatarBtn = document.getElementById("communitySetAvatarBtn");
  const avatarInput = document.getElementById("communitySetAvatarInput");
  const avatarPreview = document.getElementById("communitySetAvatarPreview");
  if (avatarBtn && avatarInput && avatarPreview) {
    avatarBtn.onclick = () => avatarInput.click();
    avatarInput.onchange = async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (file.size > 200 * 1024) {
        alert("Ukuran foto maksimal 200KB.");
        avatarInput.value = "";
        return;
      }
      communityAvatarEdit = await fileToDataUrl(file);
      avatarPreview.src = communityAvatarEdit;
    };
  }

  const saveBtn = document.getElementById("saveCommunitySettings");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      await update(ref(db, `communities/${comm.id || activeCommunityId}`), {
        name: document.getElementById("communitySetName")?.value.trim() || comm.name,
        desc: document.getElementById("communitySetDesc")?.value.trim() || "",
        category: document.getElementById("communitySetCategory")?.value || "Umum",
        visibility: document.getElementById("communitySetVisibility")?.value || "public",
        avatar: communityAvatarEdit || "default-avatar.png"
      });
      loadCommunities();
      renderCommunityDetail(activeCommunityId);
    };
  }

  const backBtn = document.getElementById("backCommunityDetail");
  if (backBtn) backBtn.onclick = () => renderCommunityDetail(activeCommunityId);

  const deleteBtn = document.getElementById("deleteCommunitySettings");
  if (deleteBtn) deleteBtn.onclick = () => deleteCommunity(activeCommunityId);

  loadCommunityAdminMembers(activeCommunityId);
}

async function fileToDataUrl(file) {
  return await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function loadCommunityAdminMembers(communityId) {
  const list = document.getElementById("communityAdminMembers");
  if (!list) return;
  list.innerHTML = "Memuat anggota...";

  const membersSnap = await get(ref(db, `community_members/${communityId}`));
  if (!membersSnap.exists()) {
    list.innerHTML = `<div class="community-empty">Belum ada anggota.</div>`;
    return;
  }

  const items = [];
  const fetches = [];
  membersSnap.forEach(m => {
    const role = m.val()?.role || "member";
    const uid = m.key;
    fetches.push(
      get(ref(db, `users/${uid}`)).then(s => ({
        uid,
        role,
        user: s.val() || {}
      }))
    );
  });

  (await Promise.all(fetches)).forEach(i => items.push(i));
  items.sort((a, b) => {
    const ro = a.role === "owner" ? 2 : a.role === "admin" ? 1 : 0;
    const rl = b.role === "owner" ? 2 : b.role === "admin" ? 1 : 0;
    if (rl !== ro) return rl - ro;
    return (a.user.username || "").localeCompare(b.user.username || "");
  });

  list.innerHTML = "";
  items.forEach(m => {
    const row = document.createElement("div");
    row.className = "community-admin-row";
    const isOwner = m.role === "owner";
    row.innerHTML = `
      <div class="community-admin-main">
        <img src="${m.user.avatar || "default-avatar.png"}">
        <div>
          <b>${m.user.username || "Pengguna"}</b>
          <small>${m.role}</small>
        </div>
      </div>
      <div class="community-admin-actions">
        ${
          isOwner
            ? `<span class="community-admin-tag">Owner</span>`
            : m.role === "admin"
              ? `
                <button class="ghost-btn" data-action="demote">Jadikan Member</button>
                <button class="ghost-btn" data-action="remove">Keluarkan</button>
              `
              : `
                <button class="ghost-btn" data-action="promote">Jadikan Admin</button>
                <button class="ghost-btn" data-action="remove">Keluarkan</button>
              `
        }
      </div>
    `;

    row.querySelectorAll("button").forEach(btn => {
      const action = btn.getAttribute("data-action");
      btn.onclick = () => {
        if (action === "promote") return setCommunityRole(communityId, m.uid, "admin");
        if (action === "demote") return setCommunityRole(communityId, m.uid, "member");
        if (action === "remove") return removeCommunityMember(communityId, m.uid);
      };
    });

    list.appendChild(row);
  });
}

async function setCommunityRole(communityId, uid, role) {
  await update(ref(db, `community_members/${communityId}/${uid}`), { role });
  loadCommunityAdminMembers(communityId);
}

async function removeCommunityMember(communityId, uid) {
  await remove(ref(db, `community_members/${communityId}/${uid}`));
  loadCommunityAdminMembers(communityId);
}

async function deleteCommunity(communityId) {
  if (!confirm("Hapus komunitas ini? Semua chat dan anggota akan hilang.")) return;
  const updates = {};
  updates[`communities/${communityId}`] = null;
  updates[`community_members/${communityId}`] = null;
  updates[`community_messages/${communityId}`] = null;
  updates[`community_join_requests/${communityId}`] = null;
  await update(ref(db), updates);
  loadCommunities();
  renderCommunitiesTab();
}

async function requestJoinCommunity(communityId, visibility) {
  const user = auth.currentUser;
  if (!user) return;

  if (visibility === "public") {
    await set(ref(db, `community_members/${communityId}/${user.uid}`), {
      role: "member",
      joinedAt: Date.now()
    });
  } else {
    await set(ref(db, `community_join_requests/${communityId}/${user.uid}`), true);
  }

  loadCommunities();
  renderCommunityDetail(communityId);
}

async function leaveCommunity(communityId) {
  const user = auth.currentUser;
  if (!user) return;
  const commSnap = await get(ref(db, `communities/${communityId}`));
  if (commSnap.exists() && commSnap.val()?.ownerId === user.uid) {
    alert("Owner tidak bisa keluar. Hapus komunitas atau transfer admin dulu.");
    return;
  }
  await remove(ref(db, `community_members/${communityId}/${user.uid}`));
  loadCommunities();
  renderCommunityDetail(communityId);
}

function renderCommunityRequestsSidebar(communityId, reqSnap, isAdmin) {
  if (!communityRequestList) return;
  if (!isAdmin) {
    communityRequestList.innerHTML = `<small>Tidak ada request.</small>`;
    return;
  }

  if (!reqSnap.exists()) {
    communityRequestList.innerHTML = `<small>Tidak ada request.</small>`;
    return;
  }

  communityRequestList.innerHTML = "";
  reqSnap.forEach(r => {
    const uid = r.key;
    get(ref(db, `users/${uid}`)).then(s => {
      const u = s.val() || {};
      const row = document.createElement("div");
      row.className = "community-req-item";
      row.innerHTML = `
        <div class="community-req-main">
          <img src="${u.avatar || "default-avatar.png"}">
          <div>
            <b>${u.username || "Pengguna"}</b>
            <small>@${u.nickname || "user"}</small>
          </div>
        </div>
        <button class="community-cta">Terima</button>
      `;
      row.querySelector("button").onclick = () => approveJoin(communityId, uid);
      communityRequestList.appendChild(row);
    });
  });
}

async function approveJoin(communityId, uid) {
  await set(ref(db, `community_members/${communityId}/${uid}`), {
    role: "member",
    joinedAt: Date.now()
  });
  await remove(ref(db, `community_join_requests/${communityId}/${uid}`));
  renderCommunityDetail(communityId);
  loadCommunities();
}

function bindCommunityChat(communityId) {
  const msgWrap = document.getElementById("communityMessages");
  if (!msgWrap) return;

  const chatRef = query(
    ref(db, `community_messages/${communityId}`),
    limitToLast(20)
  );

  onValue(chatRef, snap => {
    if (!msgWrap) return;
    msgWrap.innerHTML = "";
    snap.forEach(m => {
      const data = m.val() || {};
      const isMe = data.uid === auth.currentUser?.uid;
      const row = document.createElement("div");
      row.className = `community-bubble ${isMe ? "me" : "them"}`;
      row.innerHTML = `
        <div class="community-bubble-meta">
          <img src="${data.avatar || "default-avatar.png"}">
          <b>${data.username || "Pengguna"}</b>
          <small>${new Date(data.time || Date.now()).toLocaleString()}</small>
        </div>
        ${
          data.type === "image"
            ? `<img src="${data.imageUrl}" class="community-image">`
            : `<p>${data.text || ""}</p>`
        }
      `;
      msgWrap.appendChild(row);
    });
    msgWrap.scrollTop = msgWrap.scrollHeight;
  });

  const sendBtn = document.getElementById("communitySendBtn");
  const textEl = document.getElementById("communityText");
  const imageBtn = document.getElementById("communityImageBtn");
  const imageInput = document.getElementById("communityImage");

  if (imageBtn && imageInput) {
    imageBtn.onclick = () => imageInput.click();
  }

  if (sendBtn) {
    sendBtn.onclick = () => sendCommunityMessage(communityId);
  }
  if (textEl) {
    textEl.onkeydown = e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCommunityMessage(communityId);
      }
    };
  }
}

async function sendCommunityMessage(communityId) {
  const textEl = document.getElementById("communityText");
  const imageInput = document.getElementById("communityImage");
  const user = auth.currentUser;
  if (!user) return;

  const snap = await get(ref(db, `users/${user.uid}`));
  const u = snap.val() || {};

  const file = imageInput?.files?.[0];
  if (file) {
    if (file.size > 200 * 1024) {
      alert("Ukuran gambar maksimal 200KB.");
      return;
    }
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    await push(ref(db, `community_messages/${communityId}`), {
      uid: user.uid,
      username: u.username || "Pengguna",
      avatar: u.avatar || "default-avatar.png",
      type: "image",
      imageUrl: dataUrl,
      text: "",
      time: Date.now()
    });
    imageInput.value = "";
    return;
  }

  const text = textEl?.value.trim();
  if (!text) return;

  await push(ref(db, `community_messages/${communityId}`), {
    uid: user.uid,
    username: u.username || "Pengguna",
    avatar: u.avatar || "default-avatar.png",
    type: "text",
    text,
    imageUrl: "",
    time: Date.now()
  });

  textEl.value = "";
}

function renderFeedLoader(text) {
  if (!feed) return;
  feed.innerHTML = `
    <div class="content-loader">
      <div class="content-spinner"></div>
      <div>${text || "Memuat..."}</div>
    </div>
  `;
}

function renderFriendsTab() {
  if (!feed) return;

  feed.innerHTML = `
    <div class="dm-page">
      <div class="dm-sidebar">
        <div class="dm-title-row">
          <div>
            <h3>Chat</h3>
            <small>Pesan teman kamu</small>
          </div>
          <button class="ghost-btn dm-explore-btn" id="openExplore">Tambah Teman</button>
        </div>
        <div class="dm-chips">
          <button class="chip active" data-filter="all">Semua</button>
          <button class="chip" data-filter="friends">Teman</button>
          <button class="chip" data-filter="pending">Pending</button>
        </div>
        <input id="dmSearchInput" class="dm-search" placeholder="Cari teman...">
        <div id="dmList" class="dm-list">
          <div class="friends-loading">Memuat chat...</div>
        </div>
      </div>
      <div class="dm-chatpane" id="dmChatPane">
        <div class="dm-empty" id="dmEmpty">
          <div class="dm-empty-card">
            <h4>Mulai chat</h4>
            <p>Pilih teman di sebelah kiri untuk mulai chat.</p>
            <button class="add-btn" id="dmExploreCta">Tambah Teman</button>
          </div>
        </div>
      </div>
    </div>
  `;

  loadDMUsers();

  const search = document.getElementById("dmSearchInput");
  if (search) {
    search.oninput = () => renderDMFriendsList();
  }

  const chips = document.querySelectorAll(".dm-chips .chip");
  chips.forEach(c => {
    c.onclick = () => {
      chips.forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      dmFilterMode = c.dataset.filter || "all";
      renderDMFriendsList();
    };
  });

  const openExplore = document.getElementById("openExplore");
  const openExploreCta = document.getElementById("dmExploreCta");
  if (openExplore) {
    openExplore.onclick = () => {
      friendTabMode = "explore";
      renderFriendsExploreTab();
    };
  }
  if (openExploreCta) {
    openExploreCta.onclick = () => {
      friendTabMode = "explore";
      renderFriendsExploreTab();
    };
  }

  if (friendTabMode === "chat" && activeChatFriend) {
    renderChat(activeChatFriend);
  }
}

let friendsExploreCache = null;

let dmFriendsCache = [];

function loadDMUsers() {
  const listEl = document.getElementById("dmList");
  if (!listEl) return;

  listEl.innerHTML = `<div class="friends-loading">Memuat chat...</div>`;

  const myUid = auth.currentUser?.uid;
  if (!myUid) {
    listEl.innerHTML = `<div class="friends-empty">Belum login.</div>`;
    return;
  }

  Promise.all([
    get(ref(db, "users")),
    get(ref(db, "friends/" + myUid)),
    get(ref(db, "friend_requests"))
  ]).then(([usersSnap, friendsSnap, requestsSnap]) => {
    const friendsSet = new Set(
      friendsSnap.exists() ? Object.keys(friendsSnap.val() || {}) : []
    );
    const incomingSet = new Set(
      requestsSnap.exists() && requestsSnap.child(myUid).exists()
        ? Object.keys(requestsSnap.child(myUid).val() || {})
        : []
    );
    const outgoingSet = new Set();
    if (requestsSnap.exists()) {
      requestsSnap.forEach(r => {
        if (r.child(myUid).exists()) outgoingSet.add(r.key);
      });
    }

    if (!usersSnap.exists()) {
      dmFriendsCache = [];
      renderDMFriendsList();
      return;
    }

    const items = [];
    usersSnap.forEach(u => {
      const uid = u.key;
      if (uid === myUid) return;
      const data = u.val();
      if (!data) return;
      items.push({
        uid,
        data,
        isFriend: friendsSet.has(uid),
        isIncoming: incomingSet.has(uid),
        isOutgoing: outgoingSet.has(uid)
      });
    });

    dmFriendsCache = items.sort((a, b) => {
      const af = a.isFriend ? 1 : 0;
      const bf = b.isFriend ? 1 : 0;
      if (bf !== af) return bf - af;
      const ao = a.data.online ? 1 : 0;
      const bo = b.data.online ? 1 : 0;
      if (bo !== ao) return bo - ao;
      const al = a.data.lastSeen || 0;
      const bl = b.data.lastSeen || 0;
      if (bl !== al) return bl - al;
      const an = (a.data.username || "").toLowerCase();
      const bn = (b.data.username || "").toLowerCase();
      return an.localeCompare(bn);
    });

    renderDMFriendsList();
  });
}

function renderDMFriendsList() {
  const listEl = document.getElementById("dmList");
  const emptyEl = document.getElementById("dmEmpty");
  if (!listEl) return;

  const search = document.getElementById("dmSearchInput");
  const q = search ? search.value.toLowerCase() : "";

  if (!dmFriendsCache.length) {
    listEl.innerHTML = `<div class="friends-empty">Belum ada teman untuk chat.</div>`;
    if (emptyEl) emptyEl.classList.add("show");
    return;
  }

  const items = dmFriendsCache.filter(item => {
    const name = (item.data.username || "").toLowerCase();
    const nick = (item.data.nickname || "").toLowerCase();
    const passSearch = !q || name.includes(q) || nick.includes(q);
    let passFilter = true;
    if (dmFilterMode === "friends") passFilter = item.isFriend;
    if (dmFilterMode === "pending") passFilter = item.isIncoming || item.isOutgoing;
    return passSearch && passFilter;
  });

  if (!items.length) {
    listEl.innerHTML = `<div class="friends-empty">Tidak ada teman cocok.</div>`;
    if (emptyEl) emptyEl.classList.add("show");
    return;
  }

  listEl.innerHTML = "";
  if (emptyEl) emptyEl.classList.remove("show");

  items.forEach(item => {
    const u = item.data;
    const row = document.createElement("div");
    row.className = "dm-row";
    row.innerHTML = `
      <img src="${u.avatar || "default-avatar.png"}">
      <div class="dm-info">
        <b>${u.username || "Pengguna"}</b>
        <small>${u.online ? "Online" : `Terakhir ${timeAgo(u.lastSeen)}`}</small>
      </div>
      <div class="dm-tags">
        ${item.isFriend ? `<span class="dm-badge friend">Teman</span>` : ""}
        ${item.isOutgoing ? `<span class="dm-badge follow">Mengikuti</span>` : ""}
        ${item.isIncoming ? `<span class="dm-badge follower">Pengikut</span>` : ""}
        <span class="dm-pill">${u.online ? "●" : "•"}</span>
      </div>
    `;

    row.onclick = () => {
      activeChatFriend = item.uid;
      friendTabMode = "chat";
      renderChat(item.uid);
    };

    if (item.isIncoming && !item.isFriend) {
      const acceptBtn = document.createElement("button");
      acceptBtn.className = "dm-accept";
      acceptBtn.textContent = "Terima";
      acceptBtn.onclick = e => {
        e.stopPropagation();
        window.acceptFriend(item.uid);
      };
      row.appendChild(acceptBtn);
    }

    listEl.appendChild(row);
  });
}

async function loadFriendsExplore() {
  const listEl = document.getElementById("friendsList");
  if (!listEl) return;

  listEl.innerHTML = `<div class="friends-loading">Memuat daftar user...</div>`;

  const [usersSnap, friendsSnap, requestsSnap] = await Promise.all([
    get(ref(db, "users")),
    get(ref(db, "friends")),
    get(ref(db, "friend_requests"))
  ]);

  friendsExploreCache = { usersSnap, friendsSnap, requestsSnap };
  renderFriendsExploreList();
}

function renderFriendsExploreList() {
  const listEl = document.getElementById("friendsList");
  if (!listEl || !friendsExploreCache) return;

  const search = document.getElementById("friendSearchInput");
  const q = search ? search.value.toLowerCase() : "";
  const activeChip = document.querySelector(".friends-chips .chip.active");
  const sortMode = activeChip ? activeChip.dataset.sort : "popular";

  const { usersSnap, friendsSnap, requestsSnap } = friendsExploreCache;
  if (!usersSnap.exists()) {
    listEl.innerHTML = `<div class="friends-empty">Belum ada user.</div>`;
    return;
  }

  const items = [];
  usersSnap.forEach(u => {
    const uid = u.key;
    if (uid === auth.currentUser?.uid) return;

    const data = u.val() || {};
    const username = (data.username || "").toLowerCase();
    if (q && !username.includes(q)) return;

    const followers = friendsSnap.exists() && friendsSnap.child(uid).exists()
      ? Object.keys(friendsSnap.child(uid).val() || {}).length
      : 0;

    const isFriend = friendsSnap.exists() && friendsSnap.child(auth.currentUser.uid).child(uid).exists();
    const isRequested = requestsSnap.exists() && requestsSnap.child(uid).child(auth.currentUser.uid).exists();

    items.push({
      uid,
      data,
      followers,
      isFriend,
      isRequested
    });
  });

  items.sort((a, b) => {
    if (sortMode === "active") {
      const ao = a.data.online ? 1 : 0;
      const bo = b.data.online ? 1 : 0;
      if (bo !== ao) return bo - ao;
      return (b.data.lastSeen || 0) - (a.data.lastSeen || 0);
    }
    if (sortMode === "new") {
      const ac = a.data.createdAt || 0;
      const bc = b.data.createdAt || 0;
      if (bc !== ac) return bc - ac;
      return (b.data.lastSeen || 0) - (a.data.lastSeen || 0);
    }
    const as = a.followers * 3 + (a.data.online ? 1 : 0);
    const bs = b.followers * 3 + (b.data.online ? 1 : 0);
    if (bs !== as) return bs - as;
    return (b.data.lastSeen || 0) - (a.data.lastSeen || 0);
  });

  if (!items.length) {
    listEl.innerHTML = `<div class="friends-empty">Tidak ada user cocok.</div>`;
    return;
  }

  listEl.innerHTML = "";
  items.slice(0, 24).forEach(item => {
    const u = item.data;
    const row = document.createElement("div");
    row.className = "friend-row";
    row.innerHTML = `
      <div class="friend-main" onclick="goProfile('${item.uid}')">
        <img src="${u.avatar || "default-avatar.png"}">
        <div class="friend-info">
          <div class="friend-name">
            <b>${u.username || "Pengguna"}</b>
            ${item.isRequested ? `<span class="friend-tag">Diikuti</span>` : ""}
          </div>
          <small>${item.followers} pengikut</small>
        </div>
      </div>
      <div class="friend-actions">
        ${
          item.isFriend
            ? `<button class="ghost-btn" disabled>Teman</button>`
            : item.isRequested
              ? `<button class="ghost-btn" disabled>Diikuti</button>`
              : `<button class="add-btn" onclick="addFriend('${item.uid}', this)">Tambah</button>`
        }
      </div>
    `;
    listEl.appendChild(row);
  });
}

function renderFriendsExploreTab() {
  if (!feed) return;

  feed.innerHTML = `
    <div class="friends-page">
      <div class="friends-toolbar">
        <button class="ghost-btn" id="backToChat">← Kembali ke Chat</button>
        <input id="friendSearchInput" class="friends-search" placeholder="Cari user...">
        <div class="friends-chips">
          <button class="chip active" data-sort="popular">Populer</button>
          <button class="chip" data-sort="active">Aktif</button>
          <button class="chip" data-sort="new">Baru</button>
        </div>
      </div>
      <div id="friendsList" class="friends-list">
        <div class="friends-loading">Memuat daftar user...</div>
      </div>
    </div>
  `;

  loadFriendsExplore();

  const search = document.getElementById("friendSearchInput");
  const chips = document.querySelectorAll(".friends-chips .chip");
  if (search) {
    search.oninput = () => renderFriendsExploreList();
  }
  chips.forEach(c => {
    c.onclick = () => {
      chips.forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      renderFriendsExploreList();
    };
  });

  const backBtn = document.getElementById("backToChat");
  if (backBtn) {
    backBtn.onclick = () => {
      friendTabMode = "list";
      renderFriendsTab();
    };
  }
}

/* ================= UTILITY FUNCTIONS ================= */
function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

window.autoGrow = el => {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};

window.handleCommentKey = (e, id) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send(id);
  }
};

function showToast(message) {
  let wrap = document.getElementById("toastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toastWrap";
    document.body.appendChild(wrap);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  wrap.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

/* ================= TOGGLE POST MENU ================= */
window.togglePostMenu = function (id) {
  const menu = document.getElementById("menu-" + id);
  if (!menu) return;

  const isOpen = menu.classList.contains("show");

  // Tutup semua menu dulu
  document.querySelectorAll(".menu-dropdown").forEach(m => {
    m.classList.remove("show");
  });

  // Kalau sebelumnya belum terbuka, buka
  if (!isOpen) {
    menu.classList.add("show");
  }
};

/* ================= DELETE POST ================= */
window.deletePost = async function (id) {
  const user = auth.currentUser;
  if (!user) return;

  const postRef = ref(db, "posts/" + id);
  const snap = await get(postRef);

  if (!snap.exists()) return;

  const post = snap.val();

  // keamanan
  if (post.uid !== user.uid) {
    alert("Tidak punya izin menghapus postingan ini");
    return;
  }

  if (!confirm("Yakin ingin menghapus postingan ini?")) return;

  await remove(postRef);

  // Update UI
  allPosts = allPosts.filter(p => p.id !== id);
  renderPosts(allPosts);
};

/* ================= CLOSE MENU IF CLICK OUTSIDE ================= */
document.addEventListener("click", function (e) {
  if (!e.target.closest(".post-menu")) {
    document.querySelectorAll(".menu-dropdown").forEach(m => {
      m.classList.remove("show");
    });
  }
});
