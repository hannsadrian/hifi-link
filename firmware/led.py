import time


class StatusLED:
    """Tiny wrapper around a machine.Pin-like LED to provide simple patterns."""

    def __init__(self, pin):
        self.pin = pin

    def on(self):
        try:
            self.pin.on()
        except AttributeError:
            self.pin.value(1)

    def off(self):
        try:
            self.pin.off()
        except AttributeError:
            self.pin.value(0)

    def toggle(self):
        try:
            self.pin.toggle()
        except Exception:
            self.pin.value(0 if self.pin.value() else 1)

    def blink(self, times=1, period_ms=100):
        for _ in range(times):
            self.on()
            time.sleep_ms(period_ms)
            self.off()
            time.sleep_ms(period_ms)
