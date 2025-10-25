from storage import read_json, write_json_atomic


def _get_device(ctx, name):
    devices = read_json(ctx.get("devices_filename"), {}) or {}
    return devices, devices.get(name)


def send_command(ctx, name: str, command: str):
    devices, dev = _get_device(ctx, name)
    if not dev:
        return 404, {"error": f"Unknown device '{name}'"}

    protocol = (dev.get("protocol") or "IR").upper()
    if protocol == "IR":
        from protocols.ir import send_ir

        return send_ir(ctx, name, dev, command)

    return 501, {"error": f"Protocol '{protocol}' not implemented"}


def setup_command(ctx, name: str, command: str):
    devices, dev = _get_device(ctx, name)
    if not dev:
        # Auto-create IR device with default frequency if missing
        default_freq = ctx.get("config", {}).get("ir", {}).get("tx_freq")
        dev = {"protocol": "IR", "ir": {"tx_freq": default_freq, "codes": {}}}
        devices[name] = dev

    protocol = (dev.get("protocol") or "IR").upper()
    if protocol == "IR":
        from protocols.ir import learn_ir

        status, payload = learn_ir(ctx, name, dev, command)
        # Save updated device state (codes) if learn succeeded
        if status == 200:
            write_json_atomic(ctx.get("devices_filename"), devices)
        return status, payload

    return 501, {"error": f"Protocol '{protocol}' not implemented"}
