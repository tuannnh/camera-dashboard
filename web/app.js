const GO2RTC = window.GO2RTC_URL;
const WS_BASE = GO2RTC.replace(/^http/, "ws");

// go2rtc ships a <video-stream> web component that handles WebRTC/MSE/HLS
// signaling + auto-reconnect. It's an ES module (imports video-rtc.js), so it
// MUST be loaded as type="module". Wait until the element is actually defined.
async function loadStreamComponent() {
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "module";
    // Vendored into our own origin (video-stream.js + video-rtc.js) so the
    // module load isn't subject to cross-origin CORS against go2rtc.
    s.src = "video-stream.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load go2rtc video-stream.js"));
    document.head.appendChild(s);
  });
  await customElements.whenDefined("video-stream");
}

// --- HLS URLs (used for casting; Chromecast + AirPlay both speak HLS) ---
const hlsUrl = (id) => `${GO2RTC}/api/stream.m3u8?src=${encodeURIComponent(id)}`;

// --- Google Cast -----------------------------------------------------------
// The Cast SDK calls window.__onGCastApiAvailable when it loads. index.html
// defines a tiny shim BEFORE loading the SDK (to avoid a race) that records
// availability and defers to __initCast below.
let castReady = false;

function initCast(available) {
  if (!available || !window.chrome || !chrome.cast) return;
  cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  castReady = true;
}
window.__initCast = initCast;
// If the SDK became available before this script ran, init now.
if (window.__castApiAvailable !== undefined) initCast(window.__castApiAvailable);

async function castTo(id, name) {
  if (!castReady) {
    return alert(
      "Chromecast isn't available here.\n\n" +
        "The web Cast SDK needs Chrome/Edge AND a secure context — i.e. serve " +
        "the dashboard over HTTPS (plain http works only on localhost). " +
        "Firefox/Safari can't Chromecast from a web page."
    );
  }
  const ctx = cast.framework.CastContext.getInstance();
  try {
    await ctx.requestSession();
    const session = ctx.getCurrentSession();
    const info = new chrome.cast.media.MediaInfo(hlsUrl(id), "application/vnd.apple.mpegurl");
    info.metadata = new chrome.cast.media.GenericMediaMetadata();
    info.metadata.title = name;
    info.streamType = chrome.cast.media.StreamType.LIVE;
    await session.loadMedia(new chrome.cast.media.LoadRequest(info));
  } catch (e) {
    console.error(e);
    alert("Cast failed: " + (e.description || e.message || e));
  }
}

// --- AirPlay (Safari only) -------------------------------------------------
function airplayTo(id) {
  // AirPlay needs a real <video> playing native HLS. Build a transient one.
  const v = document.createElement("video");
  if (typeof v.webkitShowPlaybackTargetPicker !== "function") {
    return alert(
      "AirPlay is only available in Safari (macOS / iPhone / iPad).\n\n" +
        "Open this dashboard in Safari to AirPlay to your Apple TV."
    );
  }
  v.src = hlsUrl(id);
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute("x-webkit-airplay", "allow");
  v.style.display = "none";
  document.body.appendChild(v);
  v.play().then(() => v.webkitShowPlaybackTargetPicker());
}

// --- Build the grid --------------------------------------------------------
function makeTile({ id, name }) {
  const tile = document.createElement("div");
  tile.className = "tile";

  const player = document.createElement("video-stream");
  // These are PROPERTIES on VideoRTC, not HTML attributes.
  // MSE (not WebRTC): WebRTC media can't traverse an HTTP reverse proxy (its
  // :8555 media port isn't proxied), and the player would switch away from a
  // working MSE stream to a dead WebRTC one — that's why Chrome/Edge showed
  // "offline" while Firefox stayed on MSE. MSE streams over the proxied
  // WebSocket and works in every browser, on LAN and through the proxy.
  // (LAN-only users who want sub-second latency can add "webrtc" back here.)
  player.mode = "mse,hls,mjpeg";
  player.background = true; // keep the connection alive when off-screen
  // NOTE: .src is set later (in init) once the tile is in the DOM, because the
  // setter immediately connects and needs the element's <video> to exist.
  player.dataset.ws = `${WS_BASE}/api/ws?src=${encodeURIComponent(id)}`;
  tile.appendChild(player);

  // Overlay shown until real video frames arrive; flips to "Offline" if the
  // camera stays unreachable (e.g. a sleeping doorbell with RTSP shut down).
  const ph = document.createElement("div");
  ph.className = "placeholder";
  ph.innerHTML =
    `<div class="ph-name">${name}</div><div class="ph-status">Connecting…</div>`;
  tile.appendChild(ph);

  const bar = document.createElement("div");
  bar.className = "tile-bar";
  bar.innerHTML = `<span class="tile-name">${name}</span>`;

  // Both buttons always render; each explains itself if unsupported on click.
  const ap = document.createElement("button");
  ap.textContent = "AirPlay";
  ap.onclick = () => airplayTo(id);
  bar.appendChild(ap);

  const castBtn = document.createElement("button");
  castBtn.textContent = "Cast";
  castBtn.onclick = () => castTo(id, name);
  bar.appendChild(castBtn);

  tile.appendChild(bar);
  return tile;
}

// Poll each tile's <video>: hide the overlay while frames flow; after a grace
// period with no frames, label it Offline. go2rtc keeps retrying underneath.
function watchTile(tile) {
  const ph = tile.querySelector(".placeholder");
  const status = ph.querySelector(".ph-status");
  let liveSince = 0;
  let downSince = Date.now();
  setInterval(() => {
    const v = tile.querySelector("video");
    // Keep it muted (survives reconnects) and nudge playback if it stalled —
    // both guard against autoplay blocking, which reads as a false "offline".
    if (v && !v.muted) v.muted = true;
    if (v && v.paused && v.readyState >= 2) v.play().catch(() => {});
    const live = v && v.videoWidth > 0 && v.readyState >= 2 && !v.paused;
    if (live) {
      liveSince = liveSince || Date.now();
      downSince = 0;
      ph.hidden = true;
    } else {
      liveSince = 0;
      downSince = downSince || Date.now();
      ph.hidden = false;
      status.textContent =
        Date.now() - downSince > 8000 ? "Offline — camera not reachable" : "Connecting…";
    }
  }, 2000);
}

async function init() {
  try {
    await loadStreamComponent();
  } catch (e) {
    document.getElementById("grid").innerHTML =
      `<p class="error">${e.message} — is go2rtc running at ${GO2RTC}?</p>`;
    return;
  }
  const { cameras } = await fetch("cameras.json").then((r) => r.json());
  const grid = document.getElementById("grid");
  cameras.forEach((c) => {
    const tile = makeTile(c);
    grid.appendChild(tile);
    // The element is in the DOM now, so its <video> exists (created on
    // connectedCallback). Mute BEFORE connecting: the streams carry AAC, and
    // Chrome/Edge block autoplay of video *with sound* — which left the tile
    // stuck on "offline". Muted autoplay is allowed in every browser (and you
    // don't want camera audio blaring on a wall anyway).
    const player = tile.querySelector("video-stream");
    if (player.video) {
      player.video.muted = true;
      player.video.setAttribute("playsinline", "");
    }
    // Setting .src kicks off the connection (and play, now muted).
    player.src = player.dataset.ws;
    watchTile(tile);
  });
}

document.getElementById("fullscreen-btn").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
};

init();
