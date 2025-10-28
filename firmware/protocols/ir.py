import time

from storage import read_json, write_json_atomic
try:
    import _thread
except Exception:  # Fallback on platforms without _thread
    _thread = None


def _led(ctx):
    return ctx.get("led")


def _get_player_for_freq(ctx, tx_freq, asize=136):
    """Return a shared Player configured for tx_freq.

    - Reuse ctx["player"] when frequency matches the currently configured one.
    - If frequency differs (or no player yet), recreate Player and store back in ctx.
    This ensures only one underlying RMT/PIO instance exists and avoids cross-protocol stomping.
    """
    from ir.ir_tx import Player

    # Determine target frequency
    default_freq = ctx.get("config", {}).get("ir", {}).get("tx_freq")
    target_freq = int(tx_freq) if tx_freq is not None else int(default_freq) if default_freq else 38000

    # Existing player and its configured freq (we track alongside)
    player = ctx.get("player")
    current_freq = ctx.get("player_freq")

    if player is None or current_freq is None or int(current_freq) != int(target_freq):
        ir_tx_pin = ctx.get("ir_tx_pin")
        # Recreate and store as the single shared instance
        player = Player(ir_tx_pin, freq=int(target_freq), asize=asize)
        ctx["player"] = player
        ctx["player_freq"] = int(target_freq)
    return player


def _get_ir_lock(ctx):
    """Get or create a shared IR transmit lock in ctx.

    Prevents overlapping transmissions from different protocols.
    """
    lock = ctx.get("ir_lock")
    if lock is None:
        if _thread is not None:
            try:
                lock = _thread.allocate_lock()
            except Exception:
                lock = None
        ctx["ir_lock"] = lock
    return lock


def send_ir(ctx, device_name: str, device_entry: dict, command: str, options=None):
    ir_cfg = device_entry.get("ir") or {}
    tx_freq = ir_cfg.get("tx_freq") or ctx.get("config", {}).get("ir", {}).get("tx_freq")
    codes = (ir_cfg.get("commands") or {})

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

    #print(timings_to_send)
    led = _led(ctx)
    lock = _get_ir_lock(ctx)
    try:
        if led:
            led.on()
        # Serialize send if lock exists
        if lock:
            lock.acquire()
        player = _get_player_for_freq(ctx, tx_freq, asize=136)
        #print("[IR] sending '%s' for device '%s' at %s Hz (toggle %s)" % (command, device_name, tx_freq, toggle_bit))
        player.play(timings_to_send)
        #print("[IR] sent")
    finally:
        if lock:
            try:
                lock.release()
            except Exception:
                pass
        if led:
            led.off()

    ctx["toggle_bit"] = 1 - toggle_bit
    return 200, {"status": "success", "device": device_name, "command": command, "repetitions": reps, "toggle_next": ctx["toggle_bit"]}


def learn_ir(ctx, device_name: str, device_entry: dict, command: str):
    from ir.ir_rx.acquire import test as ir_acquire_test

    # Ensure structure exists
    device_entry.setdefault("ir", {})
    device_entry["ir"].setdefault("commands", {})
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

    device_entry["ir"]["commands"][command] = {"0": first, "1": second}

    if led:
        led.blink(times=3, period_ms=50)

    return 200, {"status": "success", "device": device_name, "command": command, "lengths": {"0": len(first), "1": len(second)}}
