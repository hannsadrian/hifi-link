import time
from machine import Pin


# --- Protocol Timing Constants (in microseconds) ---
# Converted from the provided Raspberry Pi (seconds) values
PRE_START_DELAY_US = 5000      # 0.005 s
START_BIT_HIGH_US = 7000       # 0.007 s
BIT_0_LOW_US = 5000            # 0.005 s
BIT_1_LOW_US = 9800            # 0.0098 s
FRAME_SIGNAL_HIGH_US = 5000    # 0.0050 s
POST_CTRL_LOW_DELAY_US = 3000  # 0.003 s


# --- Default Kenwood Command Codes ---
DEFAULT_COMMANDS = {
    "play": 121,
    "play_alt": 70,
    "stop": 68,
    "pause": 76,
    "record": 72,
    "next_track": 66,
    "prev_track": 74,
}


def _busy_wait_us(duration_us: int):
    """Precise busy-wait using ticks_us to avoid scheduler jitter."""
    if duration_us <= 0:
        return
    target = time.ticks_add(time.ticks_us(), int(duration_us))
    while time.ticks_diff(target, time.ticks_us()) > 0:
        pass


def _parse_command_code(command, mapping):
    """Resolve command to a byte (0..255).

    Accepts:
    - int (0..255)
    - decimal string ("123"), hex string ("0x7B"), binary string ("0b01111011")
    - named key resolved via mapping dict
    """
    # direct int
    try:
        if isinstance(command, int):
            return int(command) & 0xFF
    except Exception:
        pass

    # strings
    if isinstance(command, str):
        s = command.strip()
        try:
            if s.startswith("0x") or s.startswith("0X"):
                return int(s, 16) & 0xFF
            if s.startswith("0b") or s.startswith("0B"):
                return int(s, 2) & 0xFF
            if s.isdigit():
                return int(s) & 0xFF
        except Exception:
            pass

    # mapping
    if isinstance(mapping, dict) and isinstance(command, str):
        v = mapping.get(command)
        try:
            if isinstance(v, int):
                return v & 0xFF
            if isinstance(v, str):
                return _parse_command_code(v, {})
        except Exception:
            pass

    return None


def _resolve_pins(dev):
    """Read ctrl/sdat pins from device entry.

    Expects dev["kenwood_xs8"] to contain:
      { "ctrl_pin": <int>, "sdat_pin": <int>, "commands": {..}, "timing": {..(optional)..} }
    """
    cfg = dev.get("kenwood_xs8") or {}
    ctrl_pin = cfg.get("ctrl_pin")
    sdat_pin = cfg.get("sdat_pin")
    return ctrl_pin, sdat_pin, cfg


def send_kenwood_xs8(ctx, device_name, dev, command, options=None):
    """Send a Kenwood XS8 command over two GPIO pins with tight timing.

    Device configuration example (PUT /device):
      {
        "name": "deck",
        "protocol": "KENWOOD_XS8",
        "kenwood_xs8": {
          "ctrl_pin": 14,
          "sdat_pin": 15,
          "commands": { "play": 121, "stop": 68 }
        }
      }
    """
    ctrl_pin_num, sdat_pin_num, cfg = _resolve_pins(dev)
    if ctrl_pin_num is None or sdat_pin_num is None:
        return 400, {"error": "Missing kenwood_xs8.ctrl_pin or kenwood_xs8.sdat_pin in device config"}

    mapping = cfg.get("commands") or DEFAULT_COMMANDS
    code = _parse_command_code(command, mapping)
    if code is None:
        return 404, {"error": f"Unknown command '{command}' for Kenwood XS8"}

    # Allow optional timing overrides in µs
    timing = cfg.get("timing") or {}
    pre_us = int(timing.get("pre_start_us", PRE_START_DELAY_US))
    start_high_us = int(timing.get("start_high_us", START_BIT_HIGH_US))
    bit0_low_us = int(timing.get("bit0_low_us", BIT_0_LOW_US))
    bit1_low_us = int(timing.get("bit1_low_us", BIT_1_LOW_US))
    frame_high_us = int(timing.get("frame_high_us", FRAME_SIGNAL_HIGH_US))
    post_low_us = int(timing.get("post_ctrl_low_us", POST_CTRL_LOW_DELAY_US))

    # repetitions override (defaults to 1)
    reps = 1
    try:
        if options and options.get("repetitions") is not None:
            reps = max(1, int(options.get("repetitions")))
    except Exception:
        reps = 1

    # Prepare pins fresh on each call to reduce global state/timing interference
    ctrl = Pin(ctrl_pin_num, Pin.OUT, value=0)
    sdat = Pin(sdat_pin_num, Pin.OUT, value=0)

    # Protocol requires inverted data byte
    inverted_byte = (~int(code)) & 0xFF

    ctx["ir_busy"] = True
    try:
        for _ in range(reps):
            # Start sequence
            ctrl.value(1)
            _busy_wait_us(pre_us)
            sdat.value(1)
            _busy_wait_us(start_high_us)

            for i in range(7, -1, -1):
                bit = (inverted_byte >> i) & 0x1
                sdat.value(0)
                if bit == 1:
                    _busy_wait_us(bit1_low_us)
                else:
                    _busy_wait_us(bit0_low_us)
                sdat.value(1)
                _busy_wait_us(frame_high_us)

            ctrl.value(0)
            _busy_wait_us(post_low_us)
            sdat.value(0)
            # Small inter-command idle before repeating
            _busy_wait_us(2000)
    finally:
        ctx["ir_busy"] = False

    return 200, {
        "status": "success",
        "device": device_name,
        "protocol": "KENWOOD_XS8",
        "command": command,
        "code": int(code),
        "repetitions": reps,
    }


def setup_kenwood_xs8(ctx, device_name, dev, command):
    # No learning/setup flow; configuration is static via device PUT
    return 405, {"error": "KENWOOD_XS8 is encoded; configure pins and optional map via PUT /device"}
