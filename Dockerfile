# Dashboard image: static site (grid + Cast/AirPlay) served by nginx.
# go2rtc runs from its own upstream image; only this front-end is custom.
FROM nginx:alpine

# Ship the vendored go2rtc player (video-stream.js / video-rtc.js) plus our app.
COPY web/ /usr/share/nginx/html/

EXPOSE 80
