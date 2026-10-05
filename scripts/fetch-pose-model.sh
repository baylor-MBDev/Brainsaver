#!/usr/bin/env bash
# Downloads MediaPipe's pose landmarker (lite) into the exercise module's
# assets, where the pushup counter loads it on-device. Kept out of git (5.8 MB
# binary); the checksum pins the exact model the counter was tuned against.
set -euo pipefail

URL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
SHA256="59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
DEST="$(dirname "$0")/../modules/doomtype-exercise/android/src/main/assets/pose_landmarker_lite.task"

if [ -f "$DEST" ] && echo "$SHA256  $DEST" | sha256sum -c --status; then
  echo "pose model already present"
  exit 0
fi

mkdir -p "$(dirname "$DEST")"
curl -fsSL -o "$DEST" "$URL"
echo "$SHA256  $DEST" | sha256sum -c
