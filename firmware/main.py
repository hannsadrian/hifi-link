import network
from machine import Pin

import secrets
from ir.ir_tx import Player

from config import load_config
from led import StatusLED
from wifi import connect as wifi_connect
from web.server import serve
from web.handlers import (
    health_handler,
    info_handler,
    config_get_handler,
    config_put_handler,
    ui_config_get_handler,
    ui_config_put_handler,
    device_send_handler,
    device_setup_handler,
    devices_list_handler,
    device_get_handler,
    device_put_handler,
    device_delete_handler,
)


def main():
    cfg = load_config()

    # Pins and IR
    status_led_pin = Pin(cfg["pins"]["status_led"], Pin.OUT)
    led = StatusLED(status_led_pin)
    ir_tx_pin = Pin(cfg["pins"]["ir_tx"], Pin.OUT, value=0)
    player = Player(ir_tx_pin, freq=cfg["ir"]["tx_freq"])  # 36kHz default

    # Wi-Fi
    network.country('DE')
    wlan = network.WLAN(network.STA_IF)
    ip_address = wifi_connect(wlan, secrets.SSID, secrets.PASSWORD, status_led=led)
    print("Connected! Pico IP:", ip_address)

    # Shared context for handlers
    context = {
        "config": cfg,
        "led": led,
        "player": player,
        "player_freq": int(cfg["ir"]["tx_freq"]) if cfg.get("ir") and cfg["ir"].get("tx_freq") is not None else None,
        "ir_tx_pin": ir_tx_pin,
        "wlan": wlan,
        "codes_filename": cfg["storage"]["codes_filename"],
        "devices_filename": cfg["storage"]["devices_filename"],
        "ui_config_filename": cfg["storage"].get("ui_config_filename", "ui_config.json"),
        "toggle_bit": 0,
        "toggles": {},
    }

    router = {
        ("GET", "/health"): health_handler,
        ("GET", "/info"): info_handler,
        ("GET", "/config"): config_get_handler,
        ("PUT", "/config"): config_put_handler,
    # UI config (arbitrary JSON)
    ("GET", "/ui/config"): ui_config_get_handler,
    ("PUT", "/ui/config"): ui_config_put_handler,
        # Unified device operations (protocol-dispatched)
        ("GET", "/device/send"): device_send_handler,
        ("POST", "/device/setup"): device_setup_handler,
        # Devices CRUD
        ("GET", "/devices"): devices_list_handler,
        ("GET", "/device"): device_get_handler,
        ("PUT", "/device"): device_put_handler,
        ("DELETE", "/device"): device_delete_handler,
    }

    serve(cfg["web"]["port"], router, getattr(secrets, "API_KEY", None), context)


if __name__ == "__main__":
    main()