import time
from protocols.ir import _get_player_for_freq, _get_ir_lock

# --- CONFIGURATION BASED ON SAA3004 DATA SHEET ---

# 1. Frequencies
F_OSC_HZ = 400000  # Oscillator frequency from schematic (X401)
CARRIER_FREQ_HZ = 38000

# 2. Timing calculations
T_OSC_US = 1000000 / F_OSC_HZ    # Oscillator period in µs (2.5 µs)
TO_US = 1152 * T_OSC_US          # Base unit 'To' in µs (2880 µs)

# Pulse duration (Burst) for modulated mode
TM_US = 12 * T_OSC_US            # Period of the carrier frequency (30 µs)
TMH_US = 4 * T_OSC_US            # High time of the carrier frequency (10 µs)
PULSE_US = 160  # Total pulse duration (160 µs)

# Pause durations, calculated from pulse-distance coding
GAP_0_US = int((2 * TO_US) - PULSE_US)  # 5600 µs
GAP_1_US = int((3 * TO_US) - PULSE_US)  # 8480 µs

TW = 55296 * T_OSC_US # Word spacing

def _is_6bit_binary(s):
    if not isinstance(s, str) or len(s) != 6:
        return False
    for ch in s:
        if ch not in ('0', '1'):
            return False
    return True


def _parse_code(command, mapping):
    # 1) exact 6-bit binary string
    if _is_6bit_binary(command):
        return int(command, 2)
    # 2) numeric string or int
    try:
        if isinstance(command, int):
            return int(command) & 0x3F
        if isinstance(command, str) and command.isdigit():
            return int(command) & 0x3F
        if isinstance(command, str) and command.startswith("0x"):
            return int(command, 16) & 0x3F
        if isinstance(command, str) and command.startswith("0b"):
            v = int(command, 2)
            return v & 0x3F
    except Exception:
        pass
    # 3) named mapping
    if isinstance(mapping, dict) and isinstance(command, str):
        v = mapping.get(command)
        if _is_6bit_binary(v):
            return int(v, 2)
        try:
            if isinstance(v, int):
                return v & 0x3F
            if isinstance(v, str) and v.isdigit():
                return int(v) & 0x3F
            if isinstance(v, str) and v.startswith("0x"):
                return int(v, 16) & 0x3F
            if isinstance(v, str) and v.startswith("0b"):
                return int(v, 2) & 0x3F
        except Exception:
            pass
    return None


def _get_freq(ctx, dev):
    # Prefer explicit IR frequency from device.ir, fall back to SAA3004 default 33.33kHz, then global default
    try:
        ir_cfg = dev.get("ir") or {}
        if "tx_freq" in ir_cfg and ir_cfg["tx_freq"]:
            return int(ir_cfg["tx_freq"])
    except Exception:
        pass
    # SAA3004 typical carrier
    try:
        return 33333
    except Exception:
        pass
    try:
        return int(ctx.get("config", {}).get("ir", {}).get("tx_freq"))
    except Exception:
        return 33333


def send_saa3004(ctx, device_name, dev, command, options=None):
    # Resolve settings
    proto_cfg = dev.get("saa3004") or {}
    mapping = proto_cfg.get("commands") or {}
    code = _parse_code(command, mapping)
    if code is None:
        return 400, {"error": "Invalid or unknown command; provide 6-bit binary, decimal/hex, or use map."}

    # In different docs this may be called sub-address; keep alias 'address'
    sub_address = int(proto_cfg.get("sub_address", proto_cfg.get("address", 2)))

    # 1-bit toggle value per device (snippet-style)
    toggle = ctx.setdefault("toggle", {})
    toggle_t0 = int(toggle.get(device_name, 0)) & 0x1

    ref_bit = '1'
    t0_bit = '1' if toggle_t0 else '0'

    sub_address_bits = f'{sub_address:03b}'
    command_bits = f'{code:06b}'

    frame_bits = ref_bit + t0_bit + sub_address_bits + command_bits

    # repetitions can be overridden by options
    repetitions = int(proto_cfg.get("repetitions", 1))
    try:
        if options and options.get("repetitions") is not None:
            repetitions = max(1, int(options.get("repetitions")))
    except Exception:
        pass

    timings_combined = []
    for rep in range(repetitions):
        timings = []
        for bit in frame_bits:
            timings.append(int(PULSE_US))
            if bit == '0':
                timings.append(GAP_0_US)
            else: # bit == '1'
                timings.append(GAP_1_US)

        timings.append(int(PULSE_US))
        timings.append(int(TW-int(sum(timings))))
        timings_combined.extend(timings)

    freq = _get_freq(ctx, dev)
    player = _get_player_for_freq(ctx, freq, asize=138)

    # Serialize with shared lock to avoid overlap with other protocols
    lock = _get_ir_lock(ctx)
    if lock:
        lock.acquire()
    try:
        # Send via shared Player at required frequency
        player.play(timings_combined)
    finally:
        if lock:
            try:
                lock.release()
            except Exception:
                pass

    toggle[device_name] = not toggle_t0
    return 200, {
        "status": "success", "device": device_name, "protocol": "SAA3004",
        "sub_address": sub_address, "code": code, "toggle_next": toggle[device_name], "freq": freq, "bits": frame_bits, "repetitions": repetitions
    }

def setup_saa3004(ctx, device_name, dev, command):
    # SAA3004 is encoded, not learned; support only mapping updates via device PUT.
    return 405, {"error": "SAA3004 is encoded; use PUT /device to configure 'saa3004.commands' or send by 6-bit code."}
