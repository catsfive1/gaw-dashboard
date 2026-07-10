"""Agent Modules helper — local daemon for the GAW Dashboard "Agent Modules" tab.

Why this exists: a deployed (HTTPS) dashboard can't read installed versions or run
`npm i -g` / `pip install --upgrade` on this machine. This tiny localhost daemon
does — it reports INSTALLED + LATEST versions and EXECUTES the manifest's
allowlisted update command when the operator clicks "Update". Browsers allow an
HTTPS page to call http://127.0.0.1 (localhost is exempt from mixed-content block).

Security posture (single-user workstation):
  - Binds 127.0.0.1 ONLY (never 0.0.0.0).
  - CORS reflects ONLY localhost dev origins + *.pages.dev (the dashboard's home).
    A drive-by web page on any other origin fails the preflight and is blocked.
  - A per-run token (saved to ~/.agent-modules-helper/token) gates /modules and
    /update. /health echoes it so the dashboard auto-adopts it — zero copy-paste.
  - /update runs ONLY the exact `updateCmd` string from the manifest for a known
    id. No arbitrary command execution; the request body carries an id, not a cmd.

Manifest = SINGLE SOURCE OF TRUTH, shared with the dashboard:
  ../src/data/agent-modules.json

Run:
  python "D:\\AI\\_PROJECTS\\gaw-dashboard\\tools\\agent-modules-helper.py"
  (or the .ps1 launcher next to this file)

Endpoints:
  GET  /health   -> {ok, name, version, token}
  GET  /modules  -> [{id, installed, latest, outdated}]      (x-am-token required)
  POST /update   -> {ok, id, output, installed_after, error} (x-am-token required)
"""
from __future__ import annotations

import json
import re
import secrets
import shutil
import subprocess
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8791
NAME = "agent-modules-helper"
VERSION = "1.0.0"

MANIFEST_PATH = (Path(__file__).resolve().parent.parent / "src" / "data" / "agent-modules.json")
TOKEN_DIR = Path.home() / ".agent-modules-helper"
TOKEN_FILE = TOKEN_DIR / "token"

# Network probes shouldn't hang the UI.
HTTP_TIMEOUT = 8
PROBE_TIMEOUT = 30
UPDATE_TIMEOUT = 600


def load_manifest() -> list[dict]:
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return data.get("modules", [])


def get_token() -> str:
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        t = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if t:
            return t
    t = secrets.token_urlsafe(24)
    TOKEN_FILE.write_text(t, encoding="utf-8")
    return t


TOKEN = get_token()


def origin_allowed(origin: str | None) -> str | None:
    """Return the origin to echo in Access-Control-Allow-Origin, or None to deny."""
    if not origin:
        return None
    if re.match(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", origin):
        return origin
    if re.match(r"^https://([a-z0-9-]+\.)*pages\.dev$", origin):
        return origin
    return None


def _run(args: list[str], timeout: int) -> tuple[int, str]:
    """Run an arg-list command. Returns (exit_code, combined_output)."""
    try:
        p = subprocess.run(
            args, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout,
        )
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except FileNotFoundError:
        return 127, f"command not found: {args[0]}"
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout}s"


def installed_version(mod: dict) -> str | None:
    kind = mod.get("kind")
    pkg = mod.get("package", "")
    if kind == "npm-global":
        npm = shutil.which("npm")
        if not npm:
            return None
        code, out = _run([npm, "ls", "-g", pkg, "--depth=0", "--json"], PROBE_TIMEOUT)
        try:
            j = json.loads(out)
            dep = (j.get("dependencies") or {}).get(pkg) or {}
            return dep.get("version")
        except json.JSONDecodeError:
            return None
    if kind == "pip":
        code, out = _run([sys.executable, "-m", "pip", "show", pkg], PROBE_TIMEOUT)
        if code != 0:
            return None
        m = re.search(r"^Version:\s*(.+)$", out, re.MULTILINE)
        return m.group(1).strip() if m else None
    if kind == "cargo":
        cargo = shutil.which("cargo")
        if not cargo:
            return None
        code, out = _run([cargo, "install", "--list"], PROBE_TIMEOUT)
        m = re.search(rf"^{re.escape(pkg)}\s+v([^\s:]+)", out, re.MULTILINE)
        return m.group(1) if m else None
    return None


def latest_version(mod: dict) -> str | None:
    registry = mod.get("registry")
    pkg = mod.get("package", "")
    try:
        if registry == "npm":
            url = f"https://registry.npmjs.org/{pkg}/latest"
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8")).get("version")
        if registry == "pypi":
            url = f"https://pypi.org/pypi/{pkg}/json"
            with urllib.request.urlopen(url, timeout=HTTP_TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8")).get("info", {}).get("version")
    except Exception:
        return None
    return None


def is_newer(installed: str | None, latest: str | None) -> bool:
    if not installed or not latest:
        return False
    def norm(v: str) -> list[int]:
        return [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", v.lstrip("v"))]
    a, b = norm(installed), norm(latest)
    for i in range(max(len(a), len(b))):
        x = a[i] if i < len(a) else 0
        y = b[i] if i < len(b) else 0
        if y > x:
            return True
        if y < x:
            return False
    return False


def module_rows() -> list[dict]:
    rows = []
    for m in load_manifest():
        inst = installed_version(m)
        lat = latest_version(m)
        rows.append({
            "id": m["id"],
            "installed": inst,
            "latest": lat,
            "outdated": is_newer(inst, lat),
        })
    return rows


def do_update(module_id: str) -> dict:
    mod = next((m for m in load_manifest() if m["id"] == module_id), None)
    if not mod:
        return {"ok": False, "id": module_id, "output": "", "installed_after": None,
                "error": "unknown_module"}
    cmd = mod["updateCmd"]
    # Trusted, allowlisted string from our own manifest (never request input).
    code, out = _run_shell(cmd, UPDATE_TIMEOUT)
    inst_after = installed_version(mod)
    return {
        "ok": code == 0,
        "id": module_id,
        "output": out[-8000:],
        "installed_after": inst_after,
        "error": None if code == 0 else f"exit_{code}",
    }


def _run_shell(cmd: str, timeout: int) -> tuple[int, str]:
    try:
        p = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout,
        )
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"update timed out after {timeout}s"


class Handler(BaseHTTPRequestHandler):
    server_version = f"{NAME}/{VERSION}"

    def _cors(self) -> str | None:
        return origin_allowed(self.headers.get("Origin"))

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        allow = self._cors()
        if allow:
            self.send_header("Access-Control-Allow-Origin", allow)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "x-am-token, content-type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self) -> bool:
        return self.headers.get("x-am-token") == TOKEN

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, {"ok": True, "name": NAME, "version": VERSION, "token": TOKEN})
            return
        if self.path == "/modules":
            if not self._authed():
                self._send(401, {"error": "bad_token"})
                return
            self._send(200, module_rows())
            return
        self._send(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/update":
            self._send(404, {"error": "not_found"})
            return
        if not self._authed():
            self._send(401, {"error": "bad_token"})
            return
        try:
            n = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(n).decode("utf-8")) if n else {}
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"error": "bad_body"})
            return
        module_id = body.get("id")
        if not module_id:
            self._send(400, {"error": "missing_id"})
            return
        self._send(200, do_update(module_id))

    def log_message(self, fmt: str, *args) -> None:  # quieter console
        sys.stderr.write(f"[{self.address_string()}] {fmt % args}\n")


def main() -> int:
    if not MANIFEST_PATH.exists():
        print(f"[FATAL] manifest not found: {MANIFEST_PATH}", file=sys.stderr)
        return 2
    n = len(load_manifest())
    print(f"{NAME} v{VERSION}  ->  http://{HOST}:{PORT}")
    print(f"  manifest: {MANIFEST_PATH}  ({n} modules)")
    print(f"  token:    {TOKEN_FILE}")
    print("  CORS:     localhost + *.pages.dev only")
    print("  Ctrl+C to stop.")
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
