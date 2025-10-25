# Firmware architecture

This firmware targets the Raspberry Pi Pico W (MicroPython) and provides a small, modular foundation for hifi-link.

## Overview

- Configurable pins, IR frequency, and web port via `config.json` (merged over built-in defaults).
- Secrets (Wi‑Fi SSID/PASSWORD and API key) remain in `secrets.py`.
- Minimal HTTP server with routing, CORS, and JSON responses.
- Endpoints for health/info, configuration, and device send/setup (protocol-dispatched).
- Robust JSON storage with atomic writes to reduce flash corruption.
- Devices registry with CRUD to manage per-device protocol and IR codes.

## Files

- `main.py` — boot/compose: loads config, connects Wi‑Fi, builds router, runs web server.
- `config.py` — default config + `config.json` merge and save.
- `storage.py` — JSON read/write helpers with atomic writes.
- `wifi.py` — Wi‑Fi connect helper (LED blink while connecting).
- `led.py` — tiny LED wrapper with simple blink patterns.
- `web/server.py` — tiny HTTP server + router.
- `web/handlers.py` — request handlers for API endpoints.
- `protocols/` — protocol dispatch and helpers (e.g., IR) used by `/device/*` endpoints.

## API

All endpoints require an API key, supplied via `X-API-Key` header or `apikey` query parameter.

- `GET /health` — Wi‑Fi status, IP, uptime.
- `GET /info` — firmware version and current (merged) config.
- `GET /config` — current config (merged view).
- `PUT /config` — update config overrides. Body: JSON object of keys to override.
- `GET /device/send?name=<device>&command=<cmd>` — send a command via the device’s protocol.
- `POST /device/setup?name=<device>&command=<cmd>` — teach/setup a command for the device’s protocol.
- `GET /devices` — list all devices (from `devices.json`).
- `GET /device?name=<device>` — get a single device.
- `PUT /device` — create/update a device. Body JSON must include `name` and optional fields like `protocol`, `ir`.
- `DELETE /device?name=<device>` — delete a device.
 

Responses are JSON; CORS is enabled for development convenience.

## Configuration

Defaults are inside `config.py`:

```
{
  "pins": {"ir_tx": 17, "ir_rx": 16, "status_led": "LED"},
  "ir": {"tx_freq": 36000},
  "web": {"port": 80},
  "storage": {"codes_filename": "known_codes.json", "devices_filename": "devices.json"},
  "debug": false
}
```

Create a `config.json` with only overrides you need. Example:

```
{ "web": { "port": 8080 } }
```

Secrets are in `secrets.py`:

```
SSID = "..."
PASSWORD = "..."
API_KEY = "..."
```

## Quick start

1. Flash MicroPython to the Pico W.
2. Copy `firmware/` files to the device (along with `secrets.py`).
3. Optionally add `config.json`.
4. Reset the Pico; note the printed IP address.
5. Call `GET /health` to verify the device is reachable.

## Notes

- IR learn waits for two presses of the same button to capture both toggle variants.
- IR send automatically toggles between the stored variants per press.
- Storage uses atomic writes (`*.tmp` then rename) to protect against power loss.

### Devices schema

Devices are stored in `devices.json`. Suggested schema:

```
{
  "MyAmp": {
    "protocol": "IR",
    "ir": {
      "tx_freq": 38000,
      "codes": {
        "POWER": { "0": [..timings..], "1": [..timings..] },
        "VOL_UP": { "0": [...], "1": [...] }
      }
    }
  }
}
```

If a device has `protocol` other than `IR`, `/device/send` will return 501 until that protocol is implemented (placeholders for XS8/SL16).
