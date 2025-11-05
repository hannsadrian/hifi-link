import time
try:
    import urandom  # type: ignore
except Exception:
    urandom = None  # type: ignore

from storage import read_json, write_json_atomic
from protocols.dispatch import send_command as dispatch_send


def _now_s():
    try:
        return int(time.time())
    except Exception:
        # Fallback to monotonic ms if RTC not available
        return int(time.ticks_ms() // 1000)


def _iso_from_ts(ts: int) -> str:
    try:
        tm = time.localtime(ts)
        # YYYY-MM-DDTHH:MM:SS
        return "%04d-%02d-%02dT%02d:%02d:%02d" % (
            tm[0], tm[1], tm[2], tm[3], tm[4], tm[5]
        )
    except Exception:
        return str(ts)


def _gen_id() -> str:
    """Generate a UUID-like identifier without relying on CPython uuid module."""
    try:
        if urandom and hasattr(urandom, "getrandbits"):
            parts = [
                urandom.getrandbits(32),
                urandom.getrandbits(16),
                (urandom.getrandbits(16) & 0x0FFF) | 0x4000,  # version 4 style
                (urandom.getrandbits(16) & 0x3FFF) | 0x8000,  # variant
                urandom.getrandbits(48),
            ]
            return "%08x-%04x-%04x-%04x-%012x" % tuple(parts)
    except Exception:
        pass

    # Fallback: derive from time
    t = int((time.ticks_ms() if hasattr(time, "ticks_ms") else _now_s()) & 0xFFFFFFFF)
    a = (t ^ (t << 13)) & 0xFFFFFFFF
    b = (a * 1103515245 + 12345) & 0xFFFFFFFF
    c = (b * 1103515245 + 12345) & 0xFFFFFFFF
    d = (c * 1103515245 + 12345) & 0xFFFFFFFF
    return "%08x-%04x-%04x-%04x-%012x" % (a, (b >> 16) & 0xFFFF, (c >> 16) & 0xFFFF, (d >> 16) & 0xFFFF, ((a << 16) | (b & 0xFFFF)) & 0xFFFFFFFFFFFF)


class TimerManager:
    """MicroPython-friendly timer manager.

    - Stores active timers on flash (JSON)
    - Uses periodic tick() calls to evaluate and fire timers
    - Executes actions via protocols.dispatch.send_command

    Timer schema (dict):
      {
        "id": str,
        "type": str,
        "label": str,
        "created_at": ISO8601 str,
        "trigger_time": ISO8601 str,
        "trigger_ts": int epoch seconds,
        "actions": [ { "device": str, "action": str, "repetitions": int?, "delay_ms": int? }, ... ]
      }
    """

    def __init__(self, ctx: dict, filename: str = "timers.json"):
        self._ctx = ctx
        self._filename = filename
        # id -> timer
        data = read_json(self._filename, []) or []
        self._active = {}
        try:
            for t in data:
                if isinstance(t, dict) and t.get("id"):
                    self._active[t["id"]] = t
        except Exception:
            self._active = {}
        # Ephemeral test timers (not persisted)
        self._ephemeral = []  # list of timers

    # ---- persistence ----
    def _persist(self):
        try:
            write_json_atomic(self._filename, list(self._active.values()))
        except Exception as e:
            print("[timers] persist failed:", e)

    # ---- public API ----
    def list(self):
        return list(self._active.values())

    def add(self, payload: dict):
        now = _now_s()
        try:
            delay_min = int(payload.get("delay_minutes"))
        except Exception:
            delay_min = 0
        trig = now + max(0, delay_min) * 60
        t = {
            "id": _gen_id(),
            "type": payload.get("type"),
            "label": payload.get("label"),
            "created_at": _iso_from_ts(now),
            "trigger_time": _iso_from_ts(trig),
            "trigger_ts": int(trig),
            "actions": payload.get("actions") or [],
        }
        self._active[t["id"]] = t
        self._persist()
        return t

    def delete(self, timer_id: str) -> bool:
        if timer_id in self._active:
            try:
                del self._active[timer_id]
            finally:
                self._persist()
            return True
        return False

    def test(self, payload: dict):
        """Execute a timer immediately, ignoring any delays in payload.

        Does not persist the timer.
        """
        now = _now_s()
        t = {
            "id": None,
            "type": payload.get("type"),
            "label": payload.get("label"),
            "created_at": _iso_from_ts(now),
            "trigger_time": _iso_from_ts(now),
            "trigger_ts": int(now),
            "actions": payload.get("actions") or [],
        }
        # Fire immediately
        self._fire(t)
        return t

    # ---- engine ----
    def tick(self):
        """Evaluate timers and fire due ones.

        Should be called periodically (e.g., from server loop every ~200ms).
        """
        now = _now_s()

        # Collect due persistent timers
        due_ids = []
        for tid, t in self._active.items():
            try:
                if int(t.get("trigger_ts", 0)) <= now:
                    due_ids.append(tid)
            except Exception:
                pass

        timers_to_fire = []
        for tid in due_ids:
            t = self._active.get(tid)
            if t:
                timers_to_fire.append(t)
                try:
                    del self._active[tid]
                except Exception:
                    pass

        # Ephemeral timers
        if self._ephemeral:
            remaining = []
            for t in self._ephemeral:
                try:
                    if int(t.get("trigger_ts", 0)) <= now:
                        timers_to_fire.append(t)
                    else:
                        remaining.append(t)
                except Exception:
                    # drop invalid
                    pass
            self._ephemeral = remaining

        # Persist after removals
        if due_ids:
            self._persist()

        # Fire timers
        for t in timers_to_fire:
            try:
                self._fire(t)
            except Exception as e:
                print("[timers] fire error:", e)

    def _fire(self, timer: dict):
        actions = timer.get("actions") or []
        label = timer.get("label") or "(unnamed)"
        print("[timers] TRIGGER:", label, "-", len(actions), "actions")

        for i, act in enumerate(actions):
            dev = (act or {}).get("device")
            cmd = (act or {}).get("action")
            reps = None
            try:
                reps = int((act or {}).get("repetitions"))
            except Exception:
                reps = None
            delay_ms = 1000
            try:
                if (act or {}).get("delay_ms") is not None:
                    delay_ms = max(0, int(act.get("delay_ms")))
            except Exception:
                delay_ms = 1000

            if dev and cmd:
                print("  ->", dev, cmd, "reps=", reps or "default")
                options = {"repetitions": reps} if reps else None
                try:
                    status, payload = dispatch_send(self._ctx, dev, cmd, options)
                    if status != 200:
                        print("    send failed:", status, payload)
                except Exception as e:
                    print("    send exception:", e)

            # Wait between actions except after last
            if i < len(actions) - 1:
                try:
                    time.sleep_ms(int(delay_ms))
                except Exception:
                    time.sleep(1)
