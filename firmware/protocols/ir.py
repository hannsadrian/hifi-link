import time

from storage import read_json, write_json_atomic


def _led(ctx):
    return ctx.get("led")


def _get_player_for_freq(ctx, tx_freq):
    default_freq = ctx.get("config", {}).get("ir", {}).get("tx_freq")
    player = ctx.get("player")
    if tx_freq and default_freq and int(tx_freq) != int(default_freq):
        from ir.ir_tx import Player

        ir_tx_pin = ctx.get("ir_tx_pin")
        return Player(ir_tx_pin, freq=int(tx_freq))
    return player


def send_ir(ctx, device_name: str, device_entry: dict, command: str, options=None):
    ir_cfg = device_entry.get("ir") or {}
    tx_freq = ir_cfg.get("tx_freq") or ctx.get("config", {}).get("ir", {}).get("tx_freq")
    codes = (ir_cfg.get("codes") or {})

    toggle_bit = ctx.get("toggle_bit", 0)
    entry = codes.get(command) or {}
    timings = entry.get(str(toggle_bit))
    if not timings:
        return 404, {"error": f"No timings for command '{command}', toggle {toggle_bit}"}

    # repetitions override
    reps = 2  # preserve previous behavior of sending twice by default
    try:
        if options and options.get("repetitions") is not None:
            reps = max(1, int(options.get("repetitions")))
    except Exception:
        reps = 2

    # Build concatenated timings for the requested repetitions.
    # Each repetition uses the same toggle variant within this call.
    timings_to_send = []
    for i in range(reps):
        timings_to_send.extend(timings)
        if i != reps - 1:
            timings_to_send.append(27830)  # Inter-frame gap

    led = _led(ctx)
    try:
        if led:
            led.on()
        player = _get_player_for_freq(ctx, tx_freq)
        print("[IR] sending '%s' for device '%s' at %s Hz (toggle %s)" % (command, device_name, tx_freq, toggle_bit))
        player.play(timings_to_send)
    finally:
        if led:
            led.off()

    ctx["toggle_bit"] = 1 - toggle_bit
    return 200, {"status": "success", "device": device_name, "command": command, "repetitions": reps, "toggle_next": ctx["toggle_bit"]}


def learn_ir(ctx, device_name: str, device_entry: dict, command: str):
    from ir.ir_rx.acquire import test as ir_acquire_test

    # Ensure structure exists
    device_entry.setdefault("ir", {})
    device_entry["ir"].setdefault("codes", {})
    if "tx_freq" not in device_entry["ir"]:
        device_entry["ir"]["tx_freq"] = ctx.get("config", {}).get("ir", {}).get("tx_freq")

    led = _led(ctx)
    if led:
        led.off(); time.sleep(0.2); led.on(); time.sleep(0.2); led.off()

    try:
        print("[IR] learning first toggle for '%s' on '%s'..." % (command, device_name))
        if led:
            led.on()
        first = ir_acquire_test()
    finally:
        if led:
            led.off()

    try:
        time.sleep(1)
        if led:
            led.on()
        print("[IR] learning second toggle for '%s' on '%s'..." % (command, device_name))
        second = ir_acquire_test()
    finally:
        if led:
            led.off()

    device_entry["ir"]["codes"][command] = {"0": first, "1": second}

    if led:
        led.blink(times=3, period_ms=50)

    return 200, {"status": "success", "device": device_name, "command": command, "lengths": {"0": len(first), "1": len(second)}}
