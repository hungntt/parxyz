#!/usr/bin/env python3
"""Downscale a supersampled render, feather its edges, and save it as WebP with alpha.

    python3 tools/render/finish.py in.png out.webp 1200 1500 [--no-feather]
"""
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

src, dst, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert("RGBA").resize((w, h), Image.LANCZOS)

# Fade alpha towards the borders so soft shadows never end in a hard edge.
# Skip this for close-ups where the subject is meant to run off the frame.
if "--no-feather" in sys.argv:
    im.save(dst, "WEBP", quality=90, method=6)
    print(dst, im.size)
    sys.exit()
pad = int(min(w, h) * 0.06)
mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).rectangle([pad, pad, w - pad, h - pad], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(pad / 2))
r, g, b, a = im.split()
im = Image.merge("RGBA", (r, g, b, ImageChops.multiply(a, mask)))
im.save(dst, "WEBP", quality=90, method=6)
print(dst, im.size)
