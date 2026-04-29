"""
Download flower images from Unsplash and process them to match existing style:
  - 320x420 PNG
  - Cream background (240, 240, 220)
  - Photo-realistic (not vector)
"""
import os, sys, math, io, requests
from PIL import Image, ImageFilter

OUT_DIR = "/Users/yipeng/claude-workspace/Beijing flower bloom/assets/plants"
W, H = 320, 420
BG = (240, 240, 220)

# Map each plant to (filename, preferred search terms)
# URLs will be filled in from Unsplash search results
PLANTS = {
    "wintersweet": {  # 蜡梅
        "file": "wintersweet.png",
        "urls": [
            "https://unsplash.com/photos/Ge-GnuyKIP4/download?force=true",
            "https://unsplash.com/photos/YHyv-u7vbtI/download?force=true",
            "https://unsplash.com/photos/1M-B-qX5cXw/download?force=true",
            "https://unsplash.com/photos/H5C9SZaPX_Q/download?force=true",
        ]
    },
    "winter-jasmine": {  # 迎春
        "file": "winter-jasmine.png",
        "urls": [
            "https://unsplash.com/photos/E4cx_MSDAoQ/download?force=true",
            "https://unsplash.com/photos/adEACM2-CFo/download?force=true",
            "https://unsplash.com/photos/xFD4_NTn6q4/download?force=true",
        ]
    },
    "forsythia": {  # 连翘
        "file": "forsythia.png",
        "urls": [
            "https://unsplash.com/photos/a5E_FIaS-Nw/download?force=true",
            "https://unsplash.com/photos/FJLr3nxJL6k/download?force=true",
            "https://unsplash.com/photos/XKalHQItjxo/download?force=true",
        ]
    },
    "flowering-almond": {  # 榆叶梅
        "file": "flowering-almond.png",
        "urls": [
            "https://unsplash.com/photos/UBLDPBYsOwY/download?force=true",
            "https://unsplash.com/photos/RiezI09qLAg/download?force=true",
            "https://unsplash.com/photos/4LkOQRbeVok/download?force=true",
        ]
    },
    "flowering-peach": {  # 碧桃
        "file": "flowering-peach.png",
        "urls": [
            "https://unsplash.com/photos/uTxTZUqYeuk/download?force=true",
            "https://unsplash.com/photos/WjCLOT764b4/download?force=true",
            "https://unsplash.com/photos/CPrjw1GPf_Y/download?force=true",
        ]
    },
    "tulip": {  # 郁金香
        "file": "tulip.png",
        "urls": [
            "https://unsplash.com/photos/8vJxAaFFjxI/download?force=true",
            "https://unsplash.com/photos/QIIIv5P9a0c/download?force=true",
            "https://unsplash.com/photos/rlLqmf-Ty3g/download?force=true",
        ]
    },
    "peony-herbaceous": {  # 芍药
        "file": "peony-herbaceous.png",
        "urls": [
            "https://unsplash.com/photos/qtRs86B4vpQ/download?force=true",
            "https://unsplash.com/photos/Lw4J8UC2kVs/download?force=true",
            "https://unsplash.com/photos/sjFgOCdiBe0/download?force=true",
        ]
    },
    "wisteria": {  # 紫藤
        "file": "wisteria.png",
        "urls": [
            "https://unsplash.com/photos/AR2xyMqSqGs/download?force=true",
            "https://unsplash.com/photos/U_lCUqJS4Rc/download?force=true",
            "https://unsplash.com/photos/NyPmlMLqzo0/download?force=true",
        ]
    },
    "sunflower": {  # 向日葵
        "file": "sunflower.png",
        "urls": [
            "https://unsplash.com/photos/hW1u9Q3sh0Q/download?force=true",
            "https://unsplash.com/photos/X3sreAdomEA/download?force=true",
            "https://unsplash.com/photos/nvHljCwY8iU/download?force=true",
        ]
    },
    "chrysanthemum": {  # 菊花
        "file": "chrysanthemum.png",
        "urls": [
            "https://unsplash.com/photos/GachisR78i4/download?force=true",
            "https://unsplash.com/photos/uUxIcK-kbSY/download?force=true",
            "https://unsplash.com/photos/jKoP9EdA3Lw/download?force=true",
            "https://unsplash.com/photos/QTMHgof8oX0/download?force=true",
        ]
    },
}


def download_image(url, timeout=30):
    """Download an image from URL and return as PIL Image."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    img = Image.open(io.BytesIO(resp.content))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def process_image(img):
    """Resize/crop to cover 320x420, then composite onto cream background."""
    # Center-cover crop to 320:420 aspect ratio
    target_ratio = W / H
    orig_w, orig_h = img.size
    orig_ratio = orig_w / orig_h

    if orig_ratio > target_ratio:
        # Image is wider — crop width
        new_w = int(orig_h * target_ratio)
        new_h = orig_h
        x_offset = (orig_w - new_w) // 2
        y_offset = 0
    else:
        # Image is taller — crop height
        new_w = orig_w
        new_h = int(orig_w / target_ratio)
        x_offset = 0
        y_offset = (orig_h - new_h) // 2

    img = img.crop((x_offset, y_offset, x_offset + new_w, y_offset + new_h))
    img = img.resize((W, H), Image.LANCZOS)

    # Composite onto cream background (handles images with dark edges)
    bg = Image.new("RGB", (W, H), BG)
    # Blend: if image has very dark edges, slightly blend with bg
    bg.paste(img, (0, 0))
    return bg


def process_safe(img):
    """Attempt to download and process; return None on failure."""
    try:
        return process_image(img)
    except Exception as e:
        print(f"  Error processing: {e}")
        return None


def save(name, img):
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG", optimize=True)
    size = os.path.getsize(path)
    colors = len(set(list(img.getdata())))
    print(f"  {name}: {size} bytes, {colors} colors")
    return size


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    for plant_name, info in PLANTS.items():
        urls = info["urls"]
        if not urls:
            print(f"\n  [{plant_name}] No URLs provided, skipping.")
            continue

        print(f"\n[{plant_name}] → {info['file']}")
        best_img = None
        best_size = 0

        for i, url in enumerate(urls):
            try:
                print(f"  Downloading {i+1}/{len(urls)}...", end=" ")
                sys.stdout.flush()
                img = download_image(url)
                processed = process_safe(img)
                if processed is None:
                    print("skip (processing failed)")
                    continue

                # Check: too few colors suggests flat/vector image
                colors = len(set(list(processed.getdata())))
                fsize = 0
                tmp_path = os.path.join(OUT_DIR, f".tmp_{plant_name}_{i}.png")
                processed.save(tmp_path, "PNG", optimize=True)
                fsize = os.path.getsize(tmp_path)
                os.remove(tmp_path)

                print(f"{fsize} bytes, {colors} colors", end="")
                if colors < 500:
                    print(" (too few colors, skipping)")
                    continue
                if fsize < 10000:
                    print(" (too small, skipping)")
                    continue

                print(" ✓")
                if fsize > best_size:
                    best_size = fsize
                    best_img = processed

            except Exception as e:
                print(f"error: {e}")

        if best_img is not None:
            save(info["file"], best_img)
            print(f"  → Saved as {info['file']}")
        else:
            print(f"  ✗ No suitable image found for {plant_name}")


if __name__ == "__main__":
    main()
