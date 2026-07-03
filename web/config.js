// Where go2rtc is reachable FROM THE BROWSER.
// go2rtc runs with host networking on the same machine as this dashboard,
// so by default we point at the same host on port 1984.
// Override here if go2rtc lives elsewhere, e.g. "http://192.168.1.10:1984".
window.GO2RTC_URL = `${location.protocol}//${location.hostname}:1984`;
