# Camera Dashboard

An always-on webpage showing your Aqara cameras live, with one-tap casting to
Chromecast / Google TV and Apple TV (AirPlay). No NVR, no recording — just live
viewing. Your Apple Home / HomeKit integration is left completely untouched.

## How it works

```
Aqara cam ──RTSP──▶ go2rtc ──┬─ WebRTC (H.264) ─▶ dashboard grid (low latency)
                             └─ HLS ────────────▶ Chromecast / Apple TV
```

- **go2rtc** pulls each camera's RTSP stream and re-serves it as WebRTC (for the
  browser) and HLS (for casting). Aqara cameras often send H.265, so each camera
  also has an ffmpeg H.264 transcode source; go2rtc hands each client the codec
  it can play.
- **dashboard** is a static page (nginx) that shows a live grid and adds Cast /
  AirPlay buttons per camera.

## Setup

### 1. Enable RTSP on each camera
In the **Aqara Home app** → open the camera → **Settings → RTSP** → enable, and
copy the generated URL. It looks like:

```
rtsp://192.168.1.50:554/live/ch00_1?token=XXXXXXXX
```

There's no username/password — the token in the URL is the auth. Note: these
tokens can rotate; if a stream stops, grab a fresh URL and update `.env`.

> The G4 doorbell only serves RTSP when hardwired (not battery mode).

### 2. Configure
```bash
cp .env.example .env
# paste the RTSP URLs for the doorbell and G100 into .env
```
Edit `web/cameras.json` if you want different display names. The `id` values must
match the stream names in `go2rtc.yaml` (`doorbell`, `g100`).

### 3. Run
```bash
docker compose up -d
```
This pulls the prebuilt dashboard image from GHCR
(`ghcr.io/tuannnh/camera-dashboard`) and runs go2rtc from its upstream image.
To build the dashboard locally instead of pulling: `docker compose up -d --build`.

- Dashboard: **http://<host>:8088**
- go2rtc admin UI (test streams here first): **http://<host>:1984**

Open the go2rtc UI and confirm each camera plays before using the dashboard.

## Docker image / CI
A GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds the
dashboard image and pushes it to GHCR on every push to `main` (when `web/` or the
`Dockerfile` changes) and on `v*` tags.

One-time step after the first successful build: make the package pullable without a
login — GitHub → your profile → **Packages → camera-dashboard → Package settings →
Change visibility → Public**. (Or `docker login ghcr.io` on the host before pulling.)

## Casting notes
- **Chromecast / Google TV:** the **Cast** button appears once a device is on the
  network. ~2–4s latency.
- **Apple TV:** the **AirPlay** button appears only in **Safari** (macOS/iOS).
  Open the dashboard in Safari on the device you're casting from.

## Adding the E1 (later)
Uncomment the `e1` block in `go2rtc.yaml`, add `E1_RTSP` to `.env`, and add an
entry to `web/cameras.json`.

## Troubleshooting
- **Black tile but go2rtc UI works:** browser can't reach go2rtc's WebRTC port.
  Confirm port 8555 is open, or set `webrtc.candidates` to the host LAN IP in
  `go2rtc.yaml`.
- **Stream works in VLC but not the grid:** it's H.265. The ffmpeg fallback
  handles this; make sure the `ffmpeg:` source line is present for that camera.
- **Cast button never appears:** Cast SDK only works over `http://` on the LAN or
  `https://`; make sure you're on the same network as the Chromecast.
