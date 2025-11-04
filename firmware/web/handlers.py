import time

import ujson as json  # type: ignore

from storage import read_json, write_json_atomic
from protocols.dispatch import send_command as dispatch_send, setup_command as dispatch_setup


def _ensure_led(ctx):
    return ctx.get("led")


def health_handler(ctx, req):
    wlan = ctx.get("wlan")
    uptime_ms = time.ticks_ms()
    ip = None
    status = None
    try:
        status = wlan.status()
        ip = wlan.ifconfig()[0]
    except Exception:
        pass

    return 200, {
        "status": "ok",
        "wifi": {"status": status, "ip": ip},
        "uptime_ms": uptime_ms,
        "free_mem": None,  # Could add gc.mem_free() if desired
    }


def info_handler(ctx, req):
    cfg = ctx.get("config", {})
    return 200, {
        "name": "hifi-link",
        "version": "0.1.0",
        "config": cfg,
    }


def config_get_handler(ctx, req):
    return 200, ctx.get("config", {})


def config_put_handler(ctx, req):
    if not req.json or not isinstance(req.json, dict):
        return 400, {"error": "Expected JSON object"}
    # Persist as-is; caller should send only overrides
    from config import save_config

    save_config(req.json)
    # Update live context (shallow)
    cfg = ctx.get("config", {})
    cfg.update(req.json)
    return 200, {"status": "updated", "config": cfg}


# ----- UI Config (arbitrary JSON) -----

def _ui_config_filename(ctx):
    return ctx.get("ui_config_filename") or "ui_config.json"


def ui_config_get_handler(ctx, req):
    """Return arbitrary JSON previously stored for the UI.

    If the file doesn't exist or is invalid, returns an empty object.
    """
    data = read_json(_ui_config_filename(ctx), {})
    return 200, data


def ui_config_put_handler(ctx, req):
    """Store arbitrary JSON for the UI.

    Accepts any valid JSON type (object, array, string, number, boolean, null).
    """
    if not req.json or not isinstance(req.json, dict):
        return 400, {"error": "Expected JSON object"}
    write_json_atomic(_ui_config_filename(ctx), req.json)
    return 200, req.json


# ----- Devices CRUD -----

def _load_devices(ctx):
    devices = ctx.get("devices_cache")
    if devices is None:
        devices = read_json(ctx.get("devices_filename"), {}) or {}
        ctx["devices_cache"] = devices
    return devices


def _save_devices(ctx, devices):
    write_json_atomic(ctx.get("devices_filename"), devices)
    ctx["devices_cache"] = devices


def devices_list_handler(ctx, req):
    return 200, _load_devices(ctx)


def device_get_handler(ctx, req):
    name = req.params.get("name")
    if not name:
        return 400, {"error": "Missing 'name'"}
    devices = _load_devices(ctx)
    dev = devices.get(name)
    if not dev:
        return 404, {"error": f"Unknown device '{name}'"}
    resp = {"name": name}
    try:
        resp.update(dev)
    except Exception:
        # Fallback in case of unexpected types
        for k in dev:
            resp[k] = dev[k]
    return 200, resp


def _deep_merge(a, b):
    out = {}
    out.update(a or {})
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def device_put_handler(ctx, req):
    if not req.json or not isinstance(req.json, dict):
        return 400, {"error": "Expected JSON object"}
    body = req.json
    name = body.get("name")
    if not name:
        return 400, {"error": "Missing 'name' in body"}
    devices = _load_devices(ctx)
    current = devices.get(name, {})
    devices[name] = _deep_merge(current, body)
    _save_devices(ctx, devices)
    dev_payload = {"name": name}
    try:
        dev_payload.update(devices[name])
    except Exception:
        for k in devices[name]:
            dev_payload[k] = devices[name][k]
    return 200, {"status": "saved", "device": dev_payload}


def device_delete_handler(ctx, req):
    name = req.params.get("name")
    if not name:
        return 400, {"error": "Missing 'name'"}
    devices = _load_devices(ctx)
    if name not in devices:
        return 404, {"error": f"Unknown device '{name}'"}
    del devices[name]
    _save_devices(ctx, devices)
    return 200, {"status": "deleted", "name": name}


# ----- Device operations by protocol -----

def device_send_handler(ctx, req):
    name = req.params.get("name") or req.params.get("device") or (req.json or {}).get("name")
    command = req.params.get("command") or (req.json or {}).get("command")
    reps_raw = req.params.get("repetitions") or (req.json or {}).get("repetitions")
    count_raw = req.params.get("count") or (req.json or {}).get("count")
    fast_raw = req.params.get("fast") or req.params.get("async") or (req.json or {}).get("fast") or (req.json or {}).get("async") if req.json else None
    sync_raw = req.params.get("sync") or (req.json or {}).get("sync") if req.json else None
    if not name or not command:
        return 400, {"error": "Missing 'name' or 'command'"}

    # Parse optional repetitions override
    options = {}
    if reps_raw is not None:
        try:
            options["repetitions"] = max(1, int(reps_raw))
        except Exception:
            return 400, {"error": "Invalid 'repetitions' value"}

    # Parse count for repeated presses
    count = 1
    if count_raw is not None:
        try:
            count = max(1, int(count_raw))
        except Exception:
            return 400, {"error": "Invalid 'count' value"}

    # Allow comma-separated multiple commands in 'command' parameter
    # Auto-enqueue during burst or active send if queue is available and non-empty or IR is busy
    q = ctx.get("send_queue")
    queue_max = int(ctx.get("send_queue_max") or 64)
    ir_busy = bool(ctx.get("ir_busy"))

    if "," in str(command):
        commands = [c.strip() for c in str(command).split(",") if c.strip()]
        results = []
        overall_ok = True
        # Default to enqueue when a queue is available unless explicitly forced sync
        force_sync = sync_raw is not None and str(sync_raw) not in ("0", "false", "False")
        if (q is not None and not force_sync) or (fast_raw is not None and str(fast_raw) not in ("0", "false", "False")) or (q is not None and (len(q) > 0 or ir_busy)):
            # Enqueue all commands (respect count for each)
            if q is None:
                return 503, {"error": "Async queue not available"}
            max_len = queue_max
            to_enqueue = []
            for cmd in commands:
                n = count
                for _ in range(n):
                    to_enqueue.append((name, cmd, options))
            space = max_len - len(q)
            if space <= 0:
                return 429, {"error": "Queue full", "queued": len(q), "max": max_len}
            added = min(space, len(to_enqueue))
            for i in range(added):
                q.append(to_enqueue[i])
            return 202, {"status": "queued", "device": name, "enqueued": added, "pending": len(q)}
        else:
            for cmd in commands:
                status, payload = dispatch_send(ctx, name, cmd, options)
                results.append({"command": cmd, "status": status, "payload": payload})
                if status != 200:
                    overall_ok = False
        # Always return 200 with per-command statuses to avoid partial failures blocking response
        return 200, {"status": "multi", "device": name, "results": results}

    # Batch repeated presses via 'count' while preserving toggle behavior across sends

    # Default to enqueue when a queue is available unless explicitly forced sync
    force_sync = sync_raw is not None and str(sync_raw) not in ("0", "false", "False")
    if (q is not None and not force_sync) or (fast_raw is not None and str(fast_raw) not in ("0", "false", "False")) or (q is not None and (len(q) > 0 or ir_busy)):
        # Enqueue single command count times
        if q is None:
            return 503, {"error": "Async queue not available"}
        max_len = queue_max
        space = max_len - len(q)
        if space <= 0:
            return 429, {"error": "Queue full", "queued": len(q), "max": max_len}
        added = min(space, count)
        for _ in range(added):
            q.append((name, command, options))
        return 202, {"status": "queued", "device": name, "command": command, "enqueued": added, "pending": len(q)}

    if count > 1:
        ok = 0
        last_status = 200
        last_payload = None
        for _ in range(count):
            status, payload = dispatch_send(ctx, name, command, options)
            last_status, last_payload = status, payload
            if status == 200:
                ok += 1
        # Compact response to minimize payload size
        return 200, {"status": "multi", "device": name, "command": command, "count": count, "ok": ok, "last": {"status": last_status, "payload": last_payload}}

    # Single command behavior (preserve original return semantics)
    return dispatch_send(ctx, name, command, options)


def device_setup_handler(ctx, req):
    name = req.params.get("name") or req.params.get("device") or (req.json or {}).get("name")
    command = req.params.get("command") or (req.json or {}).get("command")
    if not name or not command:
        return 400, {"error": "Missing 'name' or 'command'"}
    return dispatch_setup(ctx, name, command)


def device_send_ws_handler(ctx, ws):
    """Handles device/send commands over WebSocket."""
    while ws.open:
        msg = ws.recv()
        if not msg:
            continue

        try:
            data = json.loads(msg)
            device = data.get("device")
            command = data.get("command")
            count = int(data.get("count", 1))

            if not device or not command:
                ws.send(json.dumps({"status": "error", "message": "Missing 'device' or 'command'"}))
                continue

            led = _ensure_led(ctx)
            if led:
                led.fast_blink()

            result = dispatch_send(ctx, device, command, count)

            ws.send(json.dumps(result))

        except (ValueError, TypeError):
            ws.send(json.dumps({"status": "error", "message": "Invalid JSON"}))
        except Exception as e:
            ws.send(json.dumps({"status": "error", "message": str(e)}))
