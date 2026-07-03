# Dashboard image: static site (grid + Cast/AirPlay) served by nginx, which also
# reverse-proxies /api/* to go2rtc so the whole app lives on one origin.
FROM nginx:alpine

# Where nginx should reach go2rtc from inside this container. go2rtc runs on the
# host network, so the default is the host gateway. Override in compose if go2rtc
# is a normal bridge service (e.g. GO2RTC_UPSTREAM=go2rtc:1984).
ENV GO2RTC_UPSTREAM=host.docker.internal:1984

# envsubst-templated nginx config (rendered at startup by the base image).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Static app (incl. vendored go2rtc player: video-stream.js / video-rtc.js).
COPY web/ /usr/share/nginx/html/

EXPOSE 80
