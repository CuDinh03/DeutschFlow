#!/usr/bin/env python3
"""
Generate DeutschFlow iOS App Icon — Dark Luxury design.
D-shape mark: white outline + red triangle + yellow square on #0A0A0F.
Output: 1024x1024 PNG at ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
"""

from PIL import Image, ImageDraw
import math
import os

# ─── Config ───────────────────────────────────────────────────────────────────

SIZE = 1024
OUTPUT = os.path.join(
    os.path.dirname(__file__),
    "../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
)

# Colors
BG      = (10, 10, 15)        # #0A0A0F
WHITE   = (255, 255, 255)
RED     = (218, 41, 28)       # #DA291C
YELLOW  = (255, 205, 0)       # #FFCD00

# ─── Logo geometry (viewBox 0 0 100 100, centered with padding) ───────────────
#
# The logo occupies roughly x=20..74, y=18..82 — that's 54x64 units.
# We scale the whole viewbox to 72% of icon size and center it.

LOGO_SCALE = SIZE * 0.72 / 100   # 1 viewBox unit → pixels
OFFSET_X   = (SIZE - 100 * LOGO_SCALE) / 2
OFFSET_Y   = (SIZE - 100 * LOGO_SCALE) / 2

def pt(x: float, y: float):
    """Convert viewBox coord to pixel coord."""
    return (OFFSET_X + x * LOGO_SCALE, OFFSET_Y + y * LOGO_SCALE)

def pts(*coords):
    return [pt(x, y) for x, y in coords]

# ─── Draw helpers ─────────────────────────────────────────────────────────────

def draw_thick_polygon_outline(draw, points, stroke_px, color):
    """
    Simulate thick polygon outline in PIL by drawing the filled polygon
    at expanded size, then cutting out the interior with the background color.
    Uses a simple pixel-offset approach for clean icon look.
    """
    # Draw the filled exterior shape
    draw.polygon(points, fill=color)

    # Compute centroid for inward offset
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)

    def inset_point(p, amount):
        dx = p[0] - cx
        dy = p[1] - cy
        d = math.hypot(dx, dy)
        if d < 1:
            return p
        return (p[0] - dx / d * amount, p[1] - dy / d * amount)

    inner = [inset_point(p, stroke_px) for p in points]
    draw.polygon(inner, fill=BG)

# ─── Render ───────────────────────────────────────────────────────────────────

def generate():
    img = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)

    stroke = int(6 * LOGO_SCALE)

    # ── D-shape outline ────────────────────────────────────────────────────────
    d_outer = pts(
        (20, 18), (20, 82), (52, 82), (74, 62), (74, 38), (52, 18)
    )
    draw_thick_polygon_outline(draw, d_outer, stroke, WHITE)

    # ── Red triangle (flow arrow) ──────────────────────────────────────────────
    tri = pts((52, 38), (74, 50), (52, 62))
    draw.polygon(tri, fill=RED)

    # ── Yellow square (Bauhaus) ────────────────────────────────────────────────
    sq_tl = pt(24, 45)
    sq_br = pt(33, 54)
    draw.rectangle([sq_tl, sq_br], fill=YELLOW)

    # ── Save ──────────────────────────────────────────────────────────────────
    out = os.path.abspath(OUTPUT)
    img.save(out, "PNG")
    print(f"Saved: {out}  ({SIZE}x{SIZE})")

if __name__ == "__main__":
    generate()
