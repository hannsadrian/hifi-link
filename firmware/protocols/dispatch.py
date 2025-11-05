from storage import read_json, write_json_atomic


def _get_device(ctx, name):
    devices = read_json(ctx.get("devices_filename"), {}) or {}
    return devices, devices.get(name)


def send_command(ctx, name: str, command: str, options=None):
    devices, dev = _get_device(ctx, name)
    if not dev:
        return 404, {"error": f"Unknown device '{name}'"}

    protocol = (dev.get("protocol") or "IR").upper()
    if protocol == "IR":
        from protocols.ir import send_ir

        return send_ir(ctx, name, dev, command, options)
    if protocol == "SAA3004":
        from protocols.saa3004 import send_saa3004
        return send_saa3004(ctx, name, dev, command, options)
    if protocol == "KENWOOD_XS8":
        from protocols.kenwood_xs8 import send_kenwood_xs8
        return send_kenwood_xs8(ctx, name, dev, command, options)

    return 501, {"error": f"Protocol '{protocol}' not implemented"}


def setup_command(ctx, name: str, command: str):
    devices, dev = _get_device(ctx, name)
    if not dev:
        # Auto-create IR device with default frequency if missing
        default_freq = ctx.get("config", {}).get("ir", {}).get("tx_freq")
        dev = {"protocol": "IR", "ir": {"tx_freq": default_freq, "commands": {}}}
        devices[name] = dev

    protocol = (dev.get("protocol") or "IR").upper()
    if protocol == "IR":
        from protocols.ir import learn_ir

        status, payload = learn_ir(ctx, name, dev, command)
        # Save updated device state (codes) if learn succeeded
        if status == 200:
            write_json_atomic(ctx.get("devices_filename"), devices)
        return status, payload
    if protocol == "SAA3004":
        from protocols.saa3004 import setup_saa3004
        return setup_saa3004(ctx, name, dev, command)
    if protocol == "KENWOOD_XS8":
        from protocols.kenwood_xs8 import setup_kenwood_xs8
        return setup_kenwood_xs8(ctx, name, dev, command)

    return 501, {"error": f"Protocol '{protocol}' not implemented"}
