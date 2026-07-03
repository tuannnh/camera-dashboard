#!/bin/sh
# go2rtc needs RTSP credentials embedded in the URL (rtsp://user:pass@host/path),
# but .env keeps them as separate URL/USERNAME/PASSWORD fields. Compose them here,
# stripping the rtsp:// scheme off the *_URL value before injecting user:pass.
set -e

compose() { # $1=URL $2=USER $3=PASS  ->  rtsp://user:pass@host/path
  printf 'rtsp://%s:%s@%s' "$2" "$3" "${1#rtsp://}"
}

export DOORBELL_RTSP="$(compose "$DOORBELL_RTSP_URL" "$DOORBELL_RTSP_USERNAME" "$DOORBELL_RTSP_PASSWORD")"
export G100_RTSP="$(compose "$G100_RTSP_URL" "$G100_RTSP_USERNAME" "$G100_RTSP_PASSWORD")"

exec go2rtc -config /config/go2rtc.yaml
