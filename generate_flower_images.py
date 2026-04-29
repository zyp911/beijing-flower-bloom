"""
Generate high-quality botanical-style flower PNG images.
Uses smooth gradients, anti-aliasing, and layered compositions.
"""

from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT_DIR = "/Users/yipeng/claude-workspace/Beijing flower bloom/assets/plants"
W, H = 320, 420
BG = (240, 240, 220)

def smooth_bezier(draw, pts, fill=None, outline=None, width=1, steps=60):
    """Draw a smooth closed shape using bezier-like curves."""
    if len(pts) < 3:
        return
    # Catmull-Rom to Bezier approximation
    n = len(pts)
    out = []
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]
        for t in range(steps):
            s = t / steps
            s2 = s * s
            s3 = s2 * s
            x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3)
            y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)
            out.append((x, y))
    if len(out) > 2:
        if fill:
            draw.polygon(out, fill=fill)
        if outline:
            draw.line(out, fill=outline, width=width)


def draw_petal(draw, cx, cy, r1, r2, angle, color, layers=1):
    """Draw a smooth teardrop petal at position with rotation."""
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    pts = []
    steps = 20
    for i in range(steps):
        t = i / steps * math.pi * 2
        # Teardrop shape: wider at bottom, pointed at tip
        x = math.cos(t) * r1
        y = math.sin(t) * r2 * 0.55
        # Elongate one end
        y = y - r2 * 0.3 * (1 - (abs(math.sin(t * 0.5))) * 0.5)
        # Rotate
        rx = x * cos_a - y * sin_a
        ry = x * sin_a + y * cos_a
        pts.append((cx + rx, cy + ry))

    if layers > 1:
        for layer in range(layers):
            alpha = int(255 * (1 - layer * 0.15))
            c = tuple(min(255, c + 20 * layer) for c in color)
            scale = 1 - layer * 0.08
            pts_scaled = [(cx + (p[0] - cx) * scale, cy + (p[1] - cy) * scale) for p in pts]
            smooth_bezier(draw, pts_scaled, fill=c + (alpha,))
    else:
        smooth_bezier(draw, pts, fill=color + (230,))


def make_base():
    img = Image.new("RGBA", (W, H), BG + (255,))
    # Add subtle vignette
    draw = ImageDraw.Draw(img, "RGBA")
    for r in range(200, 0, -1):
        a = int(6 * (1 - r / 200))
        if a > 0:
            draw.ellipse([W//2 - r, H//2 - r, W//2 + r, H//2 + r],
                         fill=(235, 233, 218, a))
    draw = ImageDraw.Draw(img, "RGBA")
    return img, draw


def save(name, img):
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG", optimize=True)
    print(f"  {name}: {os.path.getsize(path)} bytes")


# ═══════════════════════════════════════════════
# 1. 蜡梅 (Wintersweet) - golden yellow
# ═══════════════════════════════════════════════
def gen_wintersweet():
    img, draw = make_base()
    # Main branch
    draw.line([(30, 380), (80, 280), (140, 200), (220, 150), (290, 130)],
              fill=(110, 75, 35, 220), width=4)
    draw.line([(140, 200), (110, 150)], fill=(110, 75, 35, 220), width=2)
    draw.line([(80, 280), (50, 240)], fill=(110, 75, 35, 220), width=2)

    # Flowers along branch
    for x, y in [(80, 278), (115, 205), (150, 170), (195, 162), (245, 139)]:
        c = (201, 148, 46)
        draw_petal(draw, x, y, 15, 12, 0, c)
        draw_petal(draw, x, y, 15, 12, 1.05, c)
        draw_petal(draw, x, y, 15, 12, 2.1, c)
        draw_petal(draw, x, y, 15, 12, 3.15, c)
        draw_petal(draw, x, y, 15, 12, 4.2, c)
        # Center
        draw.ellipse([x-4, y-4, x+4, y+4], fill=(160, 95, 20, 240))
        # Anthers
        for a in range(5):
            ax = x + math.cos(a * 1.26) * 6
            ay = y + math.sin(a * 1.26) * 6
            draw.line([(x, y), (ax, ay)], fill=(180, 120, 30, 200), width=1)
            draw.ellipse([ax-1, ay-1, ax+1, ay+1], fill=(220, 180, 80, 220))

    # Buds
    bud_pos = [(110, 150), (50, 238), (270, 130), (35, 370)]
    for bx, by in bud_pos:
        for i in range(3, 0, -1):
            draw.ellipse([bx-i*2, by-i*3, bx+i*2, by], fill=(180, 130, 40, 200-i*30))

    # Subtle shadow beneath
    draw.ellipse([20, 380, 300, 400], fill=(220, 218, 200, 100))
    save("wintersweet.png", img)


# ═══════════════════════════════════════════════
# 2. 迎春 (Winter Jasmine) - bright yellow
# ═══════════════════════════════════════════════
def gen_winter_jasmine():
    img, draw = make_base()
    # Arching green branches
    for start_x, start_y in [(60, 50), (120, 30), (200, 40), (260, 60)]:
        pts = []
        for t in range(20):
            x = start_x + t * 12
            y = start_y + t * 6 + math.sin(t * 0.5) * 12
            pts.append((x, y))
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i+1]], fill=(70, 100, 40, 180), width=2)

    # 6-petal flowers along stems
    for x in range(80, 280, 18):
        y = 60 + (x - 80) * 0.4 + math.sin(x * 0.1) * 20
        if y > 350:
            continue
        c = (227, 184, 46)
        r = 8 + math.sin(x) * 3
        for a in range(6):
            angle = a / 6 * math.pi * 2
            draw_petal(draw, x + math.cos(angle) * r * 0.3, y + math.sin(angle) * r * 0.3,
                       r * 0.7, r * 0.8, angle, c)
        draw.ellipse([x-3, y-3, x+3, y+3], fill=(190, 130, 20, 240))

    save("winter-jasmine.png", img)


# ═══════════════════════════════════════════════
# 3. 连翘 (Forsythia) - golden yellow
# ═══════════════════════════════════════════════
def gen_forsythia():
    img, draw = make_base()
    # Upright arching branches
    for bx in [100, 140, 180, 220, 260]:
        pts = [(bx, 390)]
        for t in range(1, 18):
            x = bx + math.sin(t * 0.3) * 15
            y = 390 - t * 20
            pts.append((x, y))
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i+1]], fill=(90, 75, 30, 200), width=2)

    # 4-petal flowers densely along branches
    for x in range(85, 300, 12):
        y = 370 - (x - 85) * 1.6 + math.sin(x * 0.15) * 25
        if y < 60:
            continue
        c = (217, 165, 32)
        r = 9 + math.sin(x * 2) * 2
        for a in range(4):
            angle = a / 4 * math.pi * 2 + 0.2
            draw_petal(draw, x + math.cos(angle) * r * 0.25, y + math.sin(angle) * r * 0.25,
                       r * 0.75, r * 0.85, angle, c)
        draw.ellipse([x-2, y-2, x+2, y+2], fill=(160, 100, 15, 240))

    save("forsythia.png", img)


# ═══════════════════════════════════════════════
# 4. 榆叶梅 (Flowering Almond) - pink
# ═══════════════════════════════════════════════
def gen_flowering_almond():
    img, draw = make_base()
    # Dark branch
    draw.line([(50, 390), (80, 300), (120, 220), (170, 170), (230, 140), (290, 125)],
              fill=(70, 45, 35, 220), width=5)
    draw.line([(170, 170), (150, 120)], fill=(70, 45, 35, 220), width=2)
    draw.line([(120, 220), (90, 180)], fill=(70, 45, 35, 220), width=2)
    draw.line([(230, 140), (260, 110)], fill=(70, 45, 35, 220), width=2)

    # Dense pink flowers
    for x, y in [(80, 298), (100, 250), (118, 218), (140, 170), (152, 122),
                 (172, 170), (198, 158), (228, 140), (258, 118), (288, 127),
                 (92, 182), (130, 195), (220, 160), (110, 235), (185, 140)]:
        c1 = (232, 120, 138)
        c2 = (220, 100, 120)
        r = 12 + math.sin(x + y) * 3
        for a in range(5):
            angle = a / 5 * math.pi * 2
            draw_petal(draw, x + math.cos(angle) * r * 0.3, y + math.sin(angle) * r * 0.3,
                       r * 0.7, r * 0.75, angle, c1)
        draw.ellipse([x-4, y-4, x+4, y+4], fill=(190, 70, 90, 240))
        for a in range(8):
            ax = x + math.cos(a * 0.785) * 5
            ay = y + math.sin(a * 0.785) * 5
            draw.line([(x, y), (ax, ay)], fill=(220, 160, 170, 180), width=1)

    save("flowering-almond.png", img)


# ═══════════════════════════════════════════════
# 5. 碧桃 (Flowering Peach) - pink-red
# ═══════════════════════════════════════════════
def gen_flowering_peach():
    img, draw = make_base()
    # Main branch
    draw.line([(30, 390), (60, 320), (100, 240), (150, 180), (210, 140), (280, 110)],
              fill=(85, 55, 40, 220), width=5)
    draw.line([(100, 240), (70, 190)], fill=(85, 55, 40, 220), width=3)
    draw.line([(150, 180), (130, 130)], fill=(85, 55, 40, 220), width=2)
    draw.line([(210, 140), (240, 100)], fill=(85, 55, 40, 220), width=2)

    # Double-petal flowers
    for x, y in [(60, 318), (90, 218), (100, 238), (120, 178), (152, 178),
                 (132, 132), (172, 140), (208, 138), (242, 102), (278, 112),
                 (72, 192), (148, 200), (180, 155), (225, 120), (50, 350)]:
        c = (217, 96, 122)
        r = 14 + math.sin(x + y) * 4
        # Outer layer
        for a in range(6):
            angle = a / 6 * math.pi * 2
            draw_petal(draw, x + math.cos(angle) * r * 0.25, y + math.sin(angle) * r * 0.25,
                       r * 0.65, r * 0.7, angle, c)
        # Inner layer
        for a in range(5):
            angle = a / 5 * math.pi * 2 + 0.3
            draw_petal(draw, x + math.cos(angle) * r * 0.15, y + math.sin(angle) * r * 0.15,
                       r * 0.45, r * 0.5, angle, (232, 140, 158))
        draw.ellipse([x-4, y-4, x+4, y+4], fill=(170, 50, 70, 240))

    save("flowering-peach.png", img)


# ═══════════════════════════════════════════════
# 6. 郁金香 (Tulip) - red
# ═══════════════════════════════════════════════
def gen_tulip():
    img, draw = make_base()
    # Three tulips
    tulips = [(120, 380, 140, 0.95), (190, 390, 130, 1.0), (250, 385, 145, 0.9)]

    for sx, sy, cy, sc in tulips:
        # Stem
        draw.line([(sx, sy), (sx, cy)], fill=(50, 120, 50, 220), width=4)
        # Leaf
        draw.arc([sx-35, cy+20, sx, sy], -10, 160, fill=(60, 140, 55, 200), width=7)

        # Tulip cup
        cup_h = 40 * sc
        cup_w = 22 * sc
        # Outer petals
        c = (224, 85, 90)
        draw_petal(draw, sx, cy - cup_h * 0.4, cup_w * 0.85, cup_h * 0.6, 0, c)
        draw_petal(draw, sx - cup_w * 0.5, cy, cup_w * 0.65, cup_h * 0.55, -0.3, (232, 100, 105))
        draw_petal(draw, sx + cup_w * 0.5, cy, cup_w * 0.65, cup_h * 0.55, 0.3, (232, 100, 105))
        # Inner highlight
        inner = [(sx - cup_w * 0.25, cy - cup_h * 0.5, -0.15),
                 (sx + cup_w * 0.25, cy - cup_h * 0.5, 0.15)]
        for ix, iy, ia in inner:
            draw_petal(draw, ix, iy + cup_h * 0.3, cup_w * 0.35, cup_h * 0.7, ia, (240, 130, 135))

    save("tulip.png", img)


# ═══════════════════════════════════════════════
# 7. 芍药 (Herbaceous Peony) - pink
# ═══════════════════════════════════════════════
def gen_peony_herbaceous():
    img, draw = make_base()
    # Stems
    draw.line([(160, 400), (160, 200)], fill=(65, 125, 48, 220), width=5)
    draw.line([(130, 330), (100, 270)], fill=(65, 125, 48, 220), width=3)
    draw.line([(190, 350), (220, 280)], fill=(65, 125, 48, 220), width=3)

    # Leaves
    for lx, ly in [(140, 280), (170, 300), (130, 320), (180, 340),
                   (150, 360), (120, 300)]:
        draw.ellipse([lx-18, ly-7, lx+5, ly+7], fill=(75, 145, 55, 200))
        draw.ellipse([lx-5, ly-7, lx+18, ly+7], fill=(75, 145, 55, 200))
    for lx, ly in [(105, 275), (215, 285)]:
        draw.ellipse([lx-12, ly-5, lx+5, ly+5], fill=(75, 145, 55, 200))
        draw.ellipse([lx-5, ly-5, lx+12, ly+5], fill=(75, 145, 55, 200))

    # Large peony - layered
    cx, cy = 160, 150
    for layer in range(5):
        r = 55 - layer * 8
        alpha = 230 - layer * 15
        c = (232 - layer * 5, 141 - layer * 8, 176 - layer * 10)
        n = 10 - layer
        for i in range(n):
            angle = i / n * math.pi * 2 + layer * 0.7
            pr = r * (0.7 if layer % 2 else 0.85)
            draw_petal(draw,
                       cx + math.cos(angle) * r * 0.35,
                       cy + math.sin(angle) * r * 0.35,
                       pr * 0.55, pr * 0.45, angle,
                       c)
    # Center
    draw.ellipse([cx-10, cy-10, cx+10, cy+10], fill=(190, 70, 100, 255))
    for i in range(8):
        a = i / 8 * math.pi * 2
        draw.ellipse([cx+math.cos(a)*7-2, cy+math.sin(a)*7-2, cx+math.cos(a)*7+2, cy+math.sin(a)*7+2],
                     fill=(220, 150, 160, 220))

    save("peony-herbaceous.png", img)


# ═══════════════════════════════════════════════
# 8. 紫藤 (Wisteria) - purple
# ═══════════════════════════════════════════════
def gen_wisteria():
    img, draw = make_base()
    # Trellis/arbor
    draw.line([(30, 40), (290, 40)], fill=(80, 65, 50, 200), width=6)
    draw.line([(160, 40), (160, 400)], fill=(80, 65, 50, 200), width=4)
    draw.line([(90, 40), (90, 200)], fill=(80, 65, 50, 200), width=3)
    draw.line([(230, 40), (230, 180)], fill=(80, 65, 50, 200), width=3)

    # Leaves
    for lx in [110, 140, 180, 210]:
        for ly in range(100, 320, 30):
            draw.ellipse([lx-12, ly-5, lx+5, ly+5], fill=(60, 130, 55, 180))
            draw.ellipse([lx-5, ly-5, lx+12, ly+5], fill=(60, 130, 55, 180))

    # Hanging flower racemes
    clusters = [(160, 40), (120, 40), (200, 40), (80, 40), (240, 40)]
    for cx, cy in clusters:
        for i in range(12):
            y = cy + 15 + i * 14
            x = cx + math.sin(i * 0.6) * 12
            t = i / 12
            r = max(2, int(7 * (1 - t * 0.6)))
            # Gradient from purple at top to blue-purple at bottom
            purple = int(139 + 30 * (1 - t))
            blue = int(123 + 30 * (1 - t))
            red = int(184 - 20 * t)
            c = (purple, blue, red)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=c + (230,))
            if r > 3:
                draw.ellipse([x-r+1, y-r+1, x+r-1, y+r-1], fill=(min(255, c[0]+40), min(255, c[1]+40), min(255, c[2]+40), 100))

    save("wisteria.png", img)


# ═══════════════════════════════════════════════
# 9. 向日葵 (Sunflower) - golden yellow
# ═══════════════════════════════════════════════
def gen_sunflower():
    img, draw = make_base()
    # Two sunflowers
    flowers = [(160, 130, 1.0), (220, 250, 0.7)]

    for cx, cy, scale in flowers:
        # Stem
        draw.line([(cx, cy + 60 * scale), (cx, 390)], fill=(50, 120, 35, 220),
                  width=int(5 * scale))
        # Leaves
        for side in [-1, 1]:
            lx = cx + side * 20 * scale
            ly = cy + 100 * scale
            draw.ellipse([lx-12*scale, ly-5*scale, lx+5*scale, ly+5*scale],
                         fill=(55, 135, 45, 200))

        # Petals layer 1
        for i in range(18):
            angle = i / 18 * math.pi * 2
            pr = 30 * scale
            draw_petal(draw, cx + math.cos(angle) * pr * 0.3, cy + math.sin(angle) * pr * 0.3,
                       pr * 0.55, pr * 0.85, angle, (232, 184, 48))
        # Petals layer 2
        for i in range(14):
            angle = (i + 0.5) / 14 * math.pi * 2
            pr = 26 * scale
            draw_petal(draw, cx + math.cos(angle) * pr * 0.25, cy + math.sin(angle) * pr * 0.25,
                       pr * 0.45, pr * 0.7, angle, (220, 172, 40))

        # Center disc
        rd = 22 * scale
        draw.ellipse([cx-rd, cy-rd, cx+rd, cy+rd], fill=(110, 75, 15, 255))
        draw.ellipse([cx-rd+3, cy-rd+3, cx+rd-3, cy+rd-3], fill=(80, 50, 8, 255))
        # Seed pattern
        for i in range(15):
            a = i / 15 * math.pi * 2
            sr = 10 + i * 0.5 * scale
            draw.ellipse([cx+math.cos(a)*sr-2, cy+math.sin(a)*sr-2,
                          cx+math.cos(a)*sr+2, cy+math.sin(a)*sr+2],
                         fill=(60, 35, 5, 200))

    save("sunflower.png", img)


# ═══════════════════════════════════════════════
# 10. 菊花 (Chrysanthemum) - orange
# ═══════════════════════════════════════════════
def gen_chrysanthemum():
    img, draw = make_base()
    # Two flowers
    flowers = [(160, 130, 1.0), (130, 270, 0.65)]

    for cx, cy, scale in flowers:
        # Stem
        draw.line([(cx, cy + 50 * scale), (cx, 390)], fill=(50, 115, 40, 220),
                  width=int(4 * scale))
        # Leaves
        for side in [-1, 1]:
            lx = cx + side * 15 * scale
            ly = cy + 80 * scale
            draw.ellipse([lx-12*scale, ly-5*scale, lx+5*scale, ly+5*scale],
                         fill=(55, 130, 45, 200))

        # Many thin petals in layers
        for layer in range(4):
            n = 20 - layer * 3
            ca = 212 + layer * 12
            cb = 130 - layer * 18
            cc = 58 + layer * 10
            c = (ca, cb, cc)
            r = 35 - layer * 6
            for i in range(n):
                angle = i / n * math.pi * 2 + layer * 0.15
                wr = r * (0.4 + layer * 0.06) * scale
                hr = r * (1.2 - layer * 0.15) * scale
                draw_petal(draw,
                           cx + math.cos(angle) * r * 0.3 * scale,
                           cy + math.sin(angle) * r * 0.3 * scale,
                           wr, hr, angle, c)

        # Center
        r = 10 * scale
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(170, 110, 35, 255))
        draw.ellipse([cx-r+3, cy-r+3, cx+r-3, cy+r-3], fill=(140, 80, 20, 255))

    save("chrysanthemum.png", img)


if __name__ == "__main__":
    print("Generating enhanced flower images...")
    gen_wintersweet()
    gen_winter_jasmine()
    gen_forsythia()
    gen_flowering_almond()
    gen_flowering_peach()
    gen_tulip()
    gen_peony_herbaceous()
    gen_wisteria()
    gen_sunflower()
    gen_chrysanthemum()
    print("All images generated!")
