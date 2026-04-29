"""
Generate botanical PNG images matching existing style (cream bg, 320x420).
"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT_DIR = "/Users/yipeng/claude-workspace/Beijing flower bloom/assets/plants"
W, H = 320, 420
BG = (240, 240, 220)

def make_canvas():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    return img, draw

def save(name, img):
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG", optimize=True)
    colors = len(set(list(img.getdata())))
    print(f"  {name}: {os.path.getsize(path)} bytes, {colors} colors")

def petal(draw, cx, cy, r1, r2, angle, color, steps=32):
    """Anti-aliased teardrop petal"""
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    pts = []
    for i in range(steps):
        t = i / steps * math.pi * 2
        x = math.cos(t) * r1
        y = math.sin(t) * r2 * 0.5
        y = y - r2 * 0.25 * (abs(math.sin(t * 0.5)))
        rx = x * cos_a - y * sin_a
        ry = x * sin_a + y * cos_a
        pts.append((cx + rx, cy + ry))
    draw.polygon(pts, fill=color)

def radial_flower(draw, cx, cy, n, r, color, center_color):
    for i in range(n):
        angle = i / n * math.pi * 2
        petal(draw, cx + math.cos(angle)*r*0.3, cy + math.sin(angle)*r*0.3,
              r*0.6, r*0.7, angle, color)
    draw.ellipse([cx-r*0.15, cy-r*0.15, cx+r*0.15, cy+r*0.15], fill=center_color)

# ═══ 1. 蜡梅 ═══
def gen_wintersweet():
    img, draw = make_canvas()
    draw.line([(30,380),(80,280),(140,200),(220,150),(290,125)], fill=(100,68,28), width=5)
    draw.line([(140,200),(110,150)], fill=(100,68,28), width=3)
    draw.line([(80,280),(50,240)], fill=(100,68,28), width=2)
    for x,y in [(78,275),(115,210),(150,172),(198,155),(248,134),(140,204),(110,152)]:
        radial_flower(draw, x, y, 5, 16, (201,148,46), (150,90,18))
        for a in range(3):
            ax = x + math.cos(a*2.1)*5; ay = y + math.sin(a*2.1)*5
            draw.line([(x,y),(ax,ay)], fill=(180,120,30), width=1)
    save("wintersweet.png", img)

# ═══ 2. 迎春 ═══
def gen_winter_jasmine():
    img, draw = make_canvas()
    for sx,sy in [(70,30),(160,20),(240,40)]:
        pts = [(sx,sy)]
        for t in range(1,25):
            pts.append((sx+t*9, sy+t*5+math.sin(t*0.4)*15))
        for i in range(len(pts)-1):
            draw.line([pts[i],pts[i+1]], fill=(70,100,45), width=2)
    for x in range(85,290,16):
        y = 30 + (x-70)*0.35 + math.sin(x*0.08)*25
        if y < 350:
            radial_flower(draw, x, int(y), 6, 12, (227,184,46), (180,120,15))
    save("winter-jasmine.png", img)

# ═══ 3. 连翘 ═══
def gen_forsythia():
    img, draw = make_canvas()
    for bx in [100,140,180,220,260]:
        pts = [(bx,390)]
        for t in range(1,18):
            pts.append((bx+math.sin(t*0.3)*12, 390-t*20))
        for i in range(len(pts)-1):
            draw.line([pts[i],pts[i+1]], fill=(90,75,35), width=2)
    for x in range(85,290,10):
        y = 365 - (x-85)*1.5 + math.sin(x*0.12)*20
        if 60 < y < 370:
            c = (217,165,32)
            r = 10 + math.sin(x)*2
            for a in range(4):
                angle = a/4*math.pi*2 + 0.2
                petal(draw, x+math.cos(angle)*r*0.25, y+math.sin(angle)*r*0.25, r*0.7, r*0.8, angle, c)
            draw.ellipse([x-2,y-2,x+2,y+2], fill=(150,90,12))
    save("forsythia.png", img)

# ═══ 4. 榆叶梅 ═══
def gen_flowering_almond():
    img, draw = make_canvas()
    draw.line([(50,390),(80,300),(120,220),(170,170),(230,140),(290,125)], fill=(65,40,30), width=5)
    draw.line([(170,170),(150,120)], fill=(65,40,30), width=3)
    draw.line([(120,220),(90,180)], fill=(65,40,30), width=3)
    for x,y in [(80,298),(100,250),(118,218),(140,170),(152,122),(172,170),(198,158),
                (228,140),(258,118),(288,127),(92,182),(130,195),(220,160),(110,235)]:
        radial_flower(draw, x, y, 5, 14, (232,120,138), (185,65,85))
    save("flowering-almond.png", img)

# ═══ 5. 碧桃 ═══
def gen_flowering_peach():
    img, draw = make_canvas()
    draw.line([(30,390),(60,320),(100,240),(150,180),(210,140),(280,110)], fill=(78,50,35), width=5)
    draw.line([(100,240),(70,190)], fill=(78,50,35), width=3)
    draw.line([(150,180),(130,130)], fill=(78,50,35), width=2)
    draw.line([(210,140),(240,100)], fill=(78,50,35), width=2)
    for x,y in [(60,318),(90,218),(100,238),(120,178),(152,178),(132,132),
                (172,140),(208,138),(242,102),(278,112),(72,192),(148,200)]:
        c = (217,96,122)
        for a in range(6):
            angle = a/6*math.pi*2
            petal(draw, x+math.cos(angle)*15*0.25, y+math.sin(angle)*15*0.25, 10, 11, angle, c)
        for a in range(5):
            angle = a/5*math.pi*2+0.3
            petal(draw, x+math.cos(angle)*10*0.15, y+math.sin(angle)*10*0.15, 7, 8, angle, (232,140,158))
        draw.ellipse([x-4,y-4,x+4,y+4], fill=(165,45,65))
    save("flowering-peach.png", img)

# ═══ 6. 郁金香 ═══
def gen_tulip():
    img, draw = make_canvas()
    for sx,sy,cy,sc in [(120,380,150,0.95),(190,390,140,1.0),(250,385,155,0.85)]:
        draw.line([(sx,sy),(sx,cy)], fill=(50,120,50), width=4)
        draw.arc([sx-35,cy+20,sx,sy], -10, 160, fill=(60,140,55), width=7)
        c = (224,85,90)
        cup_h = 40*sc; cup_w = 22*sc
        petal(draw, sx, cy-cup_h*0.4, cup_w*0.85, cup_h*0.6, 0, c)
        petal(draw, sx-cup_w*0.5, cy, cup_w*0.65, cup_h*0.55, -0.3, (232,100,105))
        petal(draw, sx+cup_w*0.5, cy, cup_w*0.65, cup_h*0.55, 0.3, (232,100,105))
    save("tulip.png", img)

# ═══ 7. 芍药 ═══
def gen_peony_herbaceous():
    img, draw = make_canvas()
    draw.line([(160,400),(160,200)], fill=(60,120,45), width=5)
    draw.line([(125,330),(95,270)], fill=(60,120,45), width=3)
    draw.line([(195,350),(225,280)], fill=(60,120,45), width=3)
    for lx,ly in [(140,280),(170,300),(130,320),(180,340),(150,360),(120,300)]:
        draw.ellipse([lx-18,ly-7,lx+5,ly+7], fill=(72,142,52,180))
        draw.ellipse([lx-5,ly-7,lx+18,ly+7], fill=(72,142,52,180))
    cx,cy = 160,155
    for layer in range(5):
        r = 55-layer*8; c = (232-layer*5, 141-layer*8, 176-layer*10); n = 10-layer
        for i in range(n):
            angle = i/n*math.pi*2 + layer*0.7
            pr = r*(0.7 if layer%2 else 0.85)
            petal(draw, cx+math.cos(angle)*r*0.35, cy+math.sin(angle)*r*0.35, pr*0.55, pr*0.45, angle, c)
    draw.ellipse([cx-10,cy-10,cx+10,cy+10], fill=(185,65,95))
    save("peony-herbaceous.png", img)

# ═══ 8. 紫藤 ═══
def gen_wisteria():
    img, draw = make_canvas()
    draw.line([(30,40),(290,40)], fill=(75,60,45), width=6)
    draw.line([(160,40),(160,400)], fill=(75,60,45), width=4)
    draw.line([(90,40),(90,200)], fill=(75,60,45), width=3)
    draw.line([(230,40),(230,180)], fill=(75,60,45), width=3)
    for lx in [110,140,180,210]:
        for ly in range(100,320,30):
            draw.ellipse([lx-12,ly-5,lx+5,ly+5], fill=(58,128,52,160))
            draw.ellipse([lx-5,ly-5,lx+12,ly+5], fill=(58,128,52,160))
    for cx,cy in [(160,40),(120,40),(200,40),(80,40),(240,40)]:
        for i in range(12):
            y = cy+15+i*14; x = cx+math.sin(i*0.6)*12; t = i/12
            r = max(2, int(7*(1-t*0.6)))
            c = (139+int(30*(1-t)), 123+int(30*(1-t)), 184-int(20*t))
            draw.ellipse([x-r, y-r, x+r, y+r], fill=c)
    save("wisteria.png", img)

# ═══ 9. 向日葵 ═══
def gen_sunflower():
    img, draw = make_canvas()
    draw.line([(160,170),(160,410)], fill=(50,120,35), width=5)
    draw.line([(230,270),(230,410)], fill=(50,120,35), width=4)
    for side in [-1,1]:
        draw.ellipse([160+side*20-12,260-5,160+side*20+5,260+5], fill=(55,135,45,200))
    for cx,cy,sc in [(160,125,1.0),(228,240,0.7)]:
        for i in range(18):
            angle = i/18*math.pi*2; pr = 30*sc
            petal(draw, cx+math.cos(angle)*pr*0.3, cy+math.sin(angle)*pr*0.3, pr*0.55, pr*0.85, angle, (232,184,48))
        for i in range(14):
            angle = (i+0.5)/14*math.pi*2; pr = 26*sc
            petal(draw, cx+math.cos(angle)*pr*0.25, cy+math.sin(angle)*pr*0.25, pr*0.45, pr*0.7, angle, (220,172,40))
        rd = 22*sc
        draw.ellipse([cx-rd,cy-rd,cx+rd,cy+rd], fill=(110,75,15))
        draw.ellipse([cx-rd+3,cy-rd+3,cx+rd-3,cy+rd-3], fill=(80,50,8))
    save("sunflower.png", img)

# ═══ 10. 菊花 ═══
def gen_chrysanthemum():
    img, draw = make_canvas()
    draw.line([(170,190),(170,410)], fill=(50,115,40), width=4)
    draw.line([(140,290),(140,410)], fill=(50,115,40), width=3)
    for lx,ly in [(152,245),(188,270),(162,310)]:
        draw.ellipse([lx-14,ly-5,lx+5,ly+5], fill=(55,130,45,180))
        draw.ellipse([lx-5,ly-5,lx+14,ly+5], fill=(55,130,45,180))
    for cx,cy,sc in [(165,120,1.0),(135,240,0.65)]:
        for layer in range(4):
            n = 20-layer*3; r = 35-layer*6
            c = (212+layer*12, 130-layer*18, 58+layer*10)
            for i in range(n):
                angle = i/n*math.pi*2+layer*0.15
                wr = r*(0.4+layer*0.06)*sc; hr = r*(1.2-layer*0.15)*sc
                petal(draw, cx+math.cos(angle)*r*0.3*sc, cy+math.sin(angle)*r*0.3*sc, wr, hr, angle, c)
        draw.ellipse([cx-8*sc,cy-8*sc,cx+8*sc,cy+8*sc], fill=(170,110,35))
        draw.ellipse([cx-5*sc,cy-5*sc,cx+5*sc,cy+5*sc], fill=(140,80,20))
    save("chrysanthemum.png", img)

if __name__ == "__main__":
    print("Generating enhanced botanical PNGs...")
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
    print("Done!")
