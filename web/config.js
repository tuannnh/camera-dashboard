// Same-origin. The dashboard's own nginx proxies /api/* to go2rtc, so the
// browser only ever talks to this one host. This works whether you hit the
// dashboard directly (http://host:8088) or through an HTTPS reverse proxy
// (https://camera.example.com) — no separate :1984 origin, no mixed content.
window.GO2RTC_URL = location.origin;
