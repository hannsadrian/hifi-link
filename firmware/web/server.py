import socket
import ujson as json  # type: ignore
try:
    import _thread
except Exception:
    _thread = None
try:
    import time
except Exception:
    time = None

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


def _recv_http_request(conn, max_total=16384, recv_chunk=1024, timeout_s=2):
    """Receive an HTTP request fully, honoring Content-Length if present.

    Returns a UTF-8 decoded string of the full request (headers + body).
    Limits total size to max_total to avoid memory exhaustion.
    """
    try:
        conn.settimeout(timeout_s)
    except Exception:
        pass

    data = b""
    header_end = -1
    # Read until we have headers
    while True:
        chunk = conn.recv(recv_chunk)
        if not chunk:
            break
        data += chunk
        if b"\r\n\r\n" in data:
            header_end = data.find(b"\r\n\r\n") + 4
            break
        if len(data) >= max_total:
            break

    if header_end == -1:
        # No header terminator found; return whatever we have
        try:
            return data.decode("utf-8")
        except Exception:
            return data.decode("utf-8", "ignore")

    header_bytes = data[:header_end]
    body_bytes = data[header_end:]
    try:
        header_text = header_bytes.decode("utf-8")
    except Exception:
        header_text = header_bytes.decode("utf-8", "ignore")

    # Parse Content-Length (case-insensitive)
    content_length = 0
    for line in header_text.split("\r\n"):
        if ":" in line and line.lower().startswith("content-length:"):
            try:
                content_length = int(line.split(":", 1)[1].strip())
            except Exception:
                content_length = 0
            break

    # Read remaining body if needed
    remaining = max(0, content_length - len(body_bytes))
    while remaining > 0 and len(header_bytes) + len(body_bytes) < max_total:
        chunk = conn.recv(min(recv_chunk, remaining))
        if not chunk:
            break
        body_bytes += chunk
        remaining -= len(chunk)

    full = header_bytes + body_bytes
    try:
        return full.decode("utf-8")
    except Exception:
        return full.decode("utf-8", "ignore")


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
    # Allow a small backlog to handle bursts
    try:
        s.listen(8)
    except Exception:
        s.listen(1)
    print("Webserver listening on port", port)
    print("-" * 20)

    # Ensure async send queue exists and worker is running (even if main didn't set it up)
    if context.get("send_queue") is None:
        context["send_queue"] = []
    if context.get("send_queue_max") is None:
        context["send_queue_max"] = 64
    if context.get("_send_worker_started") is None:
        def _send_worker(ctx):
            from protocols.dispatch import send_command as _send
            while True:
                try:
                    item = None
                    q = ctx.get("send_queue")
                    if q:
                        try:
                            item = q.pop(0)
                        except Exception:
                            item = None
                    if item is None:
                        if time:
                            time.sleep(0.01)
                        continue
                    name, command, options = item
                    _send(ctx, name, command, options)
                except BaseException:
                    if time:
                        time.sleep(0.05)
        if _thread is not None:
            try:
                _thread.start_new_thread(_send_worker, (context,))
                context["_send_worker_started"] = True
            except Exception:
                context["_send_worker_started"] = False
        else:
            context["_send_worker_started"] = False

    try:
        while True:
            try:
                conn, _ = s.accept()
                raw = _recv_http_request(conn)
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
                try:
                    conn.close()
                except Exception:
                    pass
                print("Request error:", e)
    finally:
        s.close()
        print("Webserver socket closed.")
