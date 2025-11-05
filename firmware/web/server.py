import socket
import time
import ujson as json  # type: ignore

from .responses import json_response, send_preflight


def _parse_request(raw: str):
    # Very small HTTP parser sufficient for our use-case
    lines = raw.split("\r\n")
    if not lines or " " not in lines[0]:
        return None, None, None, {}, ""
    method, target, _ = lines[0].split(" ", 2)

    path = target
    query = ""
    if "?" in target:
        path, query = target.split("?", 1)

    headers = {}
    idx = 1
    while idx < len(lines) and lines[idx]:
        if ":" in lines[idx]:
            k, v = lines[idx].split(":", 1)
            headers[k.strip().lower()] = v.strip()
        idx += 1

    body = "\r\n".join(lines[idx + 1:]) if idx + 1 < len(lines) else ""
    return method, path, query, headers, body


def _parse_query(query: str):
    params = {}
    if not query:
        return params
    for part in query.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k] = v
        elif part:
            params[part] = ""
    return params


def _auth_ok(headers: dict, query_params: dict, expected_key: str | None):
    if not expected_key:
        return True
    api_key = headers.get("x-api-key") or query_params.get("apikey")
    return api_key == expected_key


class Request:
    def __init__(self, method, path, params, headers, body):
        self.method = method
        self.path = path
        self.params = params
        self.headers = headers
        self.body_raw = body
        self.json = None
        if body and headers.get("content-type", "").startswith("application/json"):
            try:
                self.json = json.loads(body)
            except ValueError:
                self.json = None


def serve(port: int, router, api_key: str | None, context):
    addr = socket.getaddrinfo("0.0.0.0", port)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(1)
    try:
        s.settimeout(0.2)
    except Exception:
        pass
    print("Webserver listening on port", port)
    print("-" * 20)

    try:
        while True:
            # Periodic timers tick (non-blocking)
            try:
                tm = context.get("timers") if context else None
                if tm:
                    tm.tick()
            except Exception as e:
                print("Timer tick error:", e)
            try:
                conn, _ = s.accept()
                raw = conn.recv(2048).decode("utf-8")
                method, path, query, headers, body = _parse_request(raw)
                if method is None:
                    json_response(conn, 400, {"error": "Bad request"})
                    conn.close()
                    continue

                params = _parse_query(query)
                if not _auth_ok(headers, params, api_key):
                    json_response(conn, 403, {"error": "Invalid API Key"})
                    conn.close()
                    continue

                if method == "OPTIONS":
                    send_preflight(conn)
                    conn.close()
                    continue

                req = Request(method, path, params, headers, body)

                handler = router.get((method, path)) or router.get(("*", path))
                if not handler:
                    json_response(conn, 404, {"error": "Not Found"})
                    conn.close()
                    continue

                try:
                    status, payload = handler(context, req)
                    json_response(conn, status, payload)
                except Exception as e:
                    print("Handler error:", e)
                    json_response(conn, 500, {"error": str(e)})

                conn.close()
            except Exception as e:
                # Accept timeout (no incoming connection) or handler error
                try:
                    # When timeout occurs, conn may not exist
                    if 'conn' in locals():
                        conn.close()
                except Exception:
                    pass
                # Ignore timeouts (EAGAIN/EWOULDBLOCK)
                if isinstance(e, OSError):
                    # Shallow yield
                    try:
                        time.sleep_ms(10)
                    except Exception:
                        pass
                else:
                    print("Request error:", e)
    finally:
        s.close()
        print("Webserver socket closed.")
