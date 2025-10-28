import time


def connect(wlan, ssid: str, password: str, status_led=None, timeout_s: int = 15):
    """Connect to Wi-Fi, optionally blinking a status LED while waiting.

    Returns the IP address on success; raises RuntimeError on failure.
    """
    wlan.active(True)
    try:
        # Disable power save if available (Pico W specific)
        wlan.config(pm=0xA11140)
    except Exception:
        pass

    wlan.connect(ssid, password)
    max_wait = timeout_s
    while max_wait > 0:
        st = wlan.status()
        print("Wi-Fi status:", st)
        if st < 0 or st >= 3:
            break
        max_wait -= 1
        if status_led is not None:
            try:
                status_led.toggle()
            except Exception:
                pass
        time.sleep(1)

    if wlan.status() != 3:
        raise RuntimeError("Wi-Fi connection failed")

    if status_led is not None:
        try:
            status_led.on()
        except Exception:
            pass

    ip_address = wlan.ifconfig()[0]
    return ip_address
