#!/usr/bin/env python3
"""Generate PWA icons (pure-python PNG writer, no dependencies).

Draws a VS-Code-blue rounded square with a terminal-style ">_" prompt glyph.
"""
import struct, zlib, math, os

BG = (0x00, 0x78, 0xD4)       # vscode blue
BG_DARK = (0x00, 0x5F, 0xB8)  # gradient bottom
FG = (0xFF, 0xFF, 0xFF)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect_sdf(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ox, oy = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - r


def chevron_dist(px, py, x0, y0, size, thick):
    """Distance to a '>' chevron: two line segments."""
    a = (x0, y0)
    mid = (x0 + size * 0.62, y0 + size * 0.5)
    b = (x0, y0 + size)

    def seg(p, q):
        vx, vy = q[0] - p[0], q[1] - p[1]
        wx, wy = px - p[0], py - p[1]
        t = max(0.0, min(1.0, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
        return math.hypot(wx - t * vx, wy - t * vy)

    return min(seg(a, mid), seg(mid, b)) - thick / 2


def underscore_dist(px, py, x0, y0, w, thick):
    dx = max(x0 - px, px - (x0 + w), 0.0)
    dy = max(y0 - py, py - (y0 + thick), 0.0)
    return math.hypot(dx, dy) - thick * 0.18


def render(size, maskable=False):
    img = bytearray()
    pad = 0.0 if maskable else 0.055 * size
    corner = (0.5 if maskable else 0.22) * size
    cx = cy = size / 2
    half = size / 2 - pad
    s = size / 512.0

    ch_size, ch_thick = 150 * s, 44 * s
    ch_x, ch_y = 130 * s, 175 * s
    us_w, us_thick = 118 * s, 40 * s
    us_x, us_y = 265 * s, 300 * s
    if maskable:  # keep glyph inside the safe zone
        scale = 0.78
        ch_size *= scale; ch_thick *= scale
        us_w *= scale; us_thick *= scale
        ch_x = cx - 126 * s * scale; ch_y = cy - 78 * s * scale
        us_x = cx + 9 * s * scale; us_y = cy + 47 * s * scale

    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            d = rounded_rect_sdf(px, py, cx, cy, half, half, corner)
            if d > 0.75:
                row += bytes((0, 0, 0, 0))
                continue
            alpha = 255 if d < -0.75 else round(255 * (0.75 - d) / 1.5)
            bg = lerp(BG, BG_DARK, py / size)
            g1 = chevron_dist(px, py, ch_x, ch_y, ch_size, ch_thick)
            g2 = underscore_dist(px, py, us_x, us_y, us_w, us_thick)
            g = min(g1, g2)
            if g < 0.75:
                t = 1.0 if g < -0.75 else (0.75 - g) / 1.5
                bg = lerp(bg, FG, t)
            row += bytes(bg) + bytes([alpha])
        img += row

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(img), 9))
    png += chunk(b"IEND", b"")
    return png


out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(out, exist_ok=True)
for sz in (192, 512):
    with open(os.path.join(out, f"icon-{sz}.png"), "wb") as f:
        f.write(render(sz))
    with open(os.path.join(out, f"icon-maskable-{sz}.png"), "wb") as f:
        f.write(render(sz, maskable=True))
print("icons written to public/icons")
