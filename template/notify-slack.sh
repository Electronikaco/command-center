#!/bin/bash
# notify-slack.sh — envía notificaciones al canal/DM de Slack.
# Uso: ./notify-slack.sh "tipo" "mensaje" ["detalle"]
# Tipos: info | done | epic_done | epic_ready | error | blocked | warning
#
# Si SLACK_WEBHOOK está vacío en config.sh, no envía nada — solo deja
# constancia en notifications.log. Así el orquestador funciona sin Slack.

source "$(dirname "$0")/config.sh"

TYPE="${1:-info}"
MSG="${2:-Sin mensaje}"
DETAIL="${3:-}"

case "$TYPE" in
  done)       EMOJI="✅"; COLOR="#2eb886" ;;
  epic_done)  EMOJI="🏁"; COLOR="#4CAF50" ;;
  epic_ready) EMOJI="📋"; COLOR="#9C27B0" ;;
  error)      EMOJI="🔴"; COLOR="#e01e5a" ;;
  blocked)    EMOJI="⚠️";  COLOR="#ECB22E" ;;
  warning)    EMOJI="⚠️";  COLOR="#ECB22E" ;;
  *)          EMOJI="ℹ️";  COLOR="#0070d1" ;;
esac

TS=$(date -u '+%Y-%m-%d %H:%M UTC')

if [ -z "${SLACK_WEBHOOK:-}" ]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] type=$TYPE http=skipped(no-webhook) msg=$(echo "$MSG" | head -c 120)" >> "$ORCH_DIR/notifications.log"
  exit 0
fi

if [ -n "$DETAIL" ]; then
  PAYLOAD=$(python3 -c "
import json
payload = {
  'attachments': [{
    'color': '$COLOR',
    'blocks': [
      {'type': 'section', 'text': {'type': 'mrkdwn', 'text': '$EMOJI *$PROJECT_NAME — Orquestador*'}},
      {'type': 'section', 'text': {'type': 'mrkdwn', 'text': $(echo "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}},
      {'type': 'context', 'elements': [{'type': 'mrkdwn', 'text': $(echo "$DETAIL" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}]},
      {'type': 'context', 'elements': [{'type': 'mrkdwn', 'text': '_$TS_'}]}
    ]
  }]
}
print(json.dumps(payload))
")
else
  PAYLOAD=$(python3 -c "
import json
payload = {
  'attachments': [{
    'color': '$COLOR',
    'blocks': [
      {'type': 'section', 'text': {'type': 'mrkdwn', 'text': '$EMOJI *$PROJECT_NAME — Orquestador*'}},
      {'type': 'section', 'text': {'type': 'mrkdwn', 'text': $(echo "$MSG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}},
      {'type': 'context', 'elements': [{'type': 'mrkdwn', 'text': '_$TS_'}]}
    ]
  }]
}
print(json.dumps(payload))
")
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SLACK_WEBHOOK" \
  -H 'Content-type: application/json' \
  --data "$PAYLOAD")

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] type=$TYPE http=$HTTP_CODE msg=$(echo "$MSG" | head -c 120)" >> "$ORCH_DIR/notifications.log"
[ "$HTTP_CODE" = "200" ] || echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] SLACK_ERROR http=$HTTP_CODE type=$TYPE" >> "$ORCH_DIR/notifications.log"
