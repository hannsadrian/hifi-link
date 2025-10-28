# Firmware architecture

This firmware targets the Raspberry Pi Pico W (MicroPython) and provides a small, modular foundation for hifi-link.

## Overview

- Configurable pins, IR frequency, and web port via `config.json` (merged over built-in defaults).
- Secrets (Wi‑Fi SSID/PASSWORD and API key) remain in `secrets.py`.
- Minimal HTTP server with routing, CORS, and JSON responses.
- Endpoints for health/info, configuration, and device send/setup (protocol-dispatched).
 - Simple UI configuration store (`/ui/config`) that accepts arbitrary JSON.
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
  - `protocols/ir.py` — raw learned IR send/learn support.
  - `protocols/saa3004.py` — SAA3004 (RC5) encoder using 6-bit commands.

## API

All endpoints require an API key, supplied via `X-API-Key` header or `apikey` query parameter.

- `GET /health` — Wi‑Fi status, IP, uptime.
- `GET /info` — firmware version and current (merged) config.
- `GET /config` — current config (merged view).
- `PUT /config` — update config overrides. Body: JSON object of keys to override.
 - `GET /ui/config` — return arbitrary JSON stored for the UI (from `ui_config.json`).
 - `PUT /ui/config` — store arbitrary JSON for the UI (any JSON type). Body: any JSON value.
- `GET /device/send?name=<device>&command=<cmd>` — send a command via the device’s protocol.
  - Multiple commands: comma-separate values in `command` (e.g., `command=play,stop`).
  - Override repetitions: include `repetitions=<n>` to repeat the same frame `n` times within a single send.
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
  "storage": {"codes_filename": "known_codes.json", "devices_filename": "devices.json", "ui_config_filename": "ui_config.json"},
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

### IR transmitter sharing

- All IR protocols now share a single IR Player instance stored in `ctx["player"]`.
- When a protocol needs a different carrier frequency, the Player is re-created in-place and saved back to the context, so subsequent sends use the updated configuration.
- A shared transmit lock serializes sends across protocols to prevent overlapping transmissions on the same GPIO.

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

If a device has `protocol` other than `IR`, `/device/send` will return 501 unless that protocol is implemented. Currently supported: `IR`, `SAA3004` (RC5), `KENWOOD_XS8`.

### SAA3004 (RC5) usage

Create a device using the SAA3004 encoder (default address 6 for audio):

```
PUT /device
{
  "name": "MyAmp",
  "protocol": "SAA3004",
  "saa3004": {
    "address": 6,
    "commands": {
      "on": "000000",
      "volume+": 16,
      "volume-": "0x11"
    }
  },
  "ir": { "tx_freq": 36000 }
}
```

Then send by name or code:

```
GET /device/send?name=MyAmp&command=volume+
GET /device/send?name=MyAmp&command=0b010000
GET /device/send?name=MyAmp&command=16
```

Note: SAA3004 is encoded, not learned. `/device/setup` returns 405 for this protocol; configure commands via `PUT /device`.

### Kenwood XS8 usage

Wire the two control lines to GPIO pins (CTRL and SDAT). Create a device like:

```
PUT /device
{
  "name": "KenwoodDeck",
  "protocol": "KENWOOD_XS8",
  "kenwood_xs8": {
    "ctrl_pin": 14,
    "sdat_pin": 15,
    "commands": {
      "play": 121,
      "stop": 68,
      "pause": 76,
      "next_track": 66,
      "prev_track": 74
    }
  }
}
```

Then send by name or raw code:

```
GET /device/send?name=KenwoodDeck&command=play
GET /device/send?name=KenwoodDeck&command=68
GET /device/send?name=KenwoodDeck&command=0x44
```

Timing constants are tuned for MicroPython busy-wait and can be overridden per device under `kenwood_xs8.timing` in microseconds:

```
"kenwood_xs8": {"ctrl_pin": 14, "sdat_pin": 15,
  "timing": {
    "pre_start_us": 5000,
    "start_high_us": 7000,
    "bit0_low_us": 5000,
    "bit1_low_us": 9800,
    "frame_high_us": 5000,
    "post_ctrl_low_us": 3000
  }
}
```

Note: Kenwood XS8 is encoded, not learned. `/device/setup` returns 405; configure via `PUT /device`.
