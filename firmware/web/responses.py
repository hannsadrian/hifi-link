import ujson as json  # type: ignore


def _status_line(code: int) -> str:
    mapping = {
        200: "200 OK",
        201: "201 Created",
        204: "204 No Content",
        413: "413 Payload Too Large",
        400: "400 Bad Request",
        401: "401 Unauthorized",
        403: "403 Forbidden",
        404: "404 Not Found",
        405: "405 Method Not Allowed",
        408: "408 Request Timeout",
        500: "500 Internal Server Error",
    }
    return mapping.get(code, f"{code} OK")


def cors_headers():
    return (
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, X-API-Key\r\n"
    )


def send_preflight(conn):
    conn.send("HTTP/1.1 204 No Content\r\n")
    conn.send(cors_headers())
    conn.send("\r\n")


def json_response(conn, code: int, payload):
    body = json.dumps(payload)
    conn.send("HTTP/1.1 %s\r\n" % _status_line(code))
    conn.send("Content-Type: application/json\r\n")
    conn.send(cors_headers())
    conn.send("Content-Length: %d\r\n\r\n" % len(body))
    conn.send(body)
