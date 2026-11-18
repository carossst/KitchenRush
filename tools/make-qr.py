#!/usr/bin/env python3
"""Regenerate the poster QR codes (icons/qr-fr.svg, icons/qr-en.svg).

Usage: python3 tools/make-qr.py [BASE_URL]      (needs: pip install segno)
Run it again whenever the public address of the game changes, then reprint the poster.
"""
import sys
import segno

base = sys.argv[1] if len(sys.argv) > 1 else "https://carossst.github.io/KitchenRush/"
if not base.endswith("/"):
    base += "/"
for lang in ("fr", "en"):
    segno.make(base + ("fr.html" if lang == "fr" else "?lang=en"), error="m").save(
        "icons/qr-%s.svg" % lang, scale=10, border=2, dark="#0b1026", light="#ffffff")
    print("icons/qr-%s.svg ->" % lang)
