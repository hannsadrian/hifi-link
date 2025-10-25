try:
    import ujson as json
except ImportError:
    import json  # type: ignore

try:
    import uos as os  # MicroPython
except ImportError:
    import os  # CPython fallback for local testing


def read_json(path, default=None):
    """Read JSON file from flash. Return default on missing/invalid content."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {} if default is None else default


def write_json_atomic(path, data):
    """Write JSON atomically to reduce corruption risk on power loss."""
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    try:
        # os.replace exists on CPython; on MicroPython use rename after remove
        if hasattr(os, "replace"):
            os.replace(tmp, path)
        else:
            try:
                os.remove(path)
            except OSError:
                pass
            os.rename(tmp, path)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
