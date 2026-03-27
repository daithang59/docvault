#!/bin/sh
# ────────────────────────────────────────────────────────────────────
# seed-roles.sh
# Ensures all demo users have the correct realm roles assigned in
# Keycloak.  The built-in --import-realm flag only runs on the very
# first start, so subsequent restarts skip role mapping.  This script
# idempotently fixes that by calling the Admin REST API.
# ────────────────────────────────────────────────────────────────────

set -e

KC_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
KC_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KC_ADMIN_PW="${KEYCLOAK_ADMIN_PASSWORD:-adminpw}"
REALM="${KEYCLOAK_REALM:-docvault}"

echo "[seed-roles] Waiting for Keycloak to be ready at ${KC_URL}..."
until curl -fsS "${KC_URL}/health/ready" > /dev/null 2>&1; do
  sleep 2
done
echo "[seed-roles] Keycloak is ready."

# ── Get admin token ──────────────────────────────────────────────────
get_token() {
  curl -sS -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password&client_id=admin-cli&username=${KC_ADMIN}&password=${KC_ADMIN_PW}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])"
}

TOKEN=$(get_token)

# ── Helper: get user ID by username ──────────────────────────────────
get_user_id() {
  curl -sS "${KC_URL}/admin/realms/${REALM}/users?username=$1&exact=true" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import sys,json; users=json.load(sys.stdin); print(users[0]['id'] if users else '')"
}

# ── Helper: get role representation by name ──────────────────────────
get_role() {
  curl -sS "${KC_URL}/admin/realms/${REALM}/roles/$1" \
    -H "Authorization: Bearer ${TOKEN}"
}

# ── Helper: assign role to user (idempotent – returns 204 even if already assigned) ─
assign_role() {
  local username="$1"
  shift
  local user_id
  user_id=$(get_user_id "${username}")
  if [ -z "${user_id}" ]; then
    echo "[seed-roles]   SKIP ${username} – user not found"
    return
  fi

  local role_payload="["
  local first=1
  for role_name in "$@"; do
    local role_json
    role_json=$(get_role "${role_name}")
    if [ $first -eq 1 ]; then first=0; else role_payload="${role_payload},"; fi
    role_payload="${role_payload}${role_json}"
  done
  role_payload="${role_payload}]"

  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "${KC_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${role_payload}")

  echo "[seed-roles]   ${username} → $* (HTTP ${status})"
}

# ── Assign roles ─────────────────────────────────────────────────────
echo "[seed-roles] Assigning realm roles in '${REALM}'..."
assign_role admin1    admin
assign_role viewer1   viewer
assign_role editor1   editor
assign_role approver1 approver
assign_role co1       co compliance_officer
echo "[seed-roles] Done."
