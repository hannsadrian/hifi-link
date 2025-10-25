from storage import read_json, write_json_atomic

DEFAULT_CONFIG = {
    "pins": {
        "ir_tx": 17,
        "ir_rx": 16,
        "status_led": "LED",
    },
    "ir": {
        "tx_freq": 36000,
    },
    "web": {
        "port": 80,
    },
    "storage": {
        "codes_filename": "known_codes.json",
        "devices_filename": "devices.json",
    },
    "debug": False,
}


def _deep_merge(base, override):
    out = {}
    for k in base:
        out[k] = base[k]
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config():
    cfg_on_flash = read_json("config.json", {})
    return _deep_merge(DEFAULT_CONFIG, cfg_on_flash or {})


def save_config(cfg):
    # Only persist overrides to keep flash writes minimal
    write_json_atomic("config.json", cfg)
