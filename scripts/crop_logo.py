#!/usr/bin/env python3
"""Build the SSC header mark and app icon.

If brand/source.png exists, crop the crown, SSC shield, and
"Stemp's Sports Cards" wordmark out of it and leave off the
"$1 Football Cards" promo. Otherwise draw a black-and-gold mark
from the same layout so the app still has a logo.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BRAND = ROOT / "brand"
SOURCE = BRAND / "source.png"
FONTS = BRAND / "fonts"
GOLD = (226, 179, 58, 255)
GOLD_DEEP = (138, 104, 18, 255)
WHITE = (246, 241, 228, 255)
BLACK = (0, 0, 0, 255)


def ink_rows(image: Image.Image) -> list[int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    counts: list[int] = []
    pixels = rgb.load()
    for y in range(height):
        count = 0
        for x in range(0, width, 2):
            red, green, blue = pixels[x, y]
            if red + green + blue > 50:
                count += 1
        counts.append(count)
    return counts


def bands(counts: list[int], gap: int = 14) -> list[tuple[int, int]]:
    found: list[tuple[int, int]] = []
    start = None
    quiet = 0
    for y, count in enumerate(counts):
        if count > 8:
            if start is None:
                start = y
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= gap:
                found.append((start, y - quiet))
                start = None
                quiet = 0
    if start is not None:
        found.append((start, len(counts) - 1))
    return found


def crop_source(source: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Keep the top wordmark and a square of the crown plus shield."""
    counts = ink_rows(source)
    groups = bands(counts)
    height = source.height
    print("content bands:", groups)
    if not groups:
        raise SystemExit("source logo has no visible artwork")
    # The promo (Football Cards / $1 / cards) sits in the lower half.
    wordmark_end = groups[0][1]
    for top, bottom in groups:
        if bottom > height * 0.46:
            break
        wordmark_end = bottom
    pad = 12
    top = max(0, groups[0][0] - pad)
    bottom = min(height, wordmark_end + pad)
    wordmark = source.crop((0, top, source.width, bottom))
    # Shield and crown are the narrow top band, centered.
    shield_bottom = min(bottom, groups[0][1] + pad)
    shield = source.crop((0, top, source.width, shield_bottom))
    box = shield.convert("RGB").getbbox()
    if box:
        left, upper, right, lower = box
        side = max(right - left, lower - upper) + 48
        center_x = (left + right) // 2
        center_y = (upper + lower) // 2
        icon = Image.new("RGB", (side, side), (0, 0, 0))
        crop = shield.crop((
            max(0, center_x - side // 2),
            max(0, center_y - side // 2),
            min(shield.width, center_x + side // 2),
            min(shield.height, center_y + side // 2),
        ))
        icon.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
    else:
        icon = shield
    return wordmark.convert("RGBA"), icon.convert("RGBA")


def font(url: str, name: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    FONTS.mkdir(parents=True, exist_ok=True)
    path = FONTS / name
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return ImageFont.truetype(str(path), size)


def text_size(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=face)
    return box[2] - box[0], box[3] - box[1]


def stroke_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    stroke: int,
    stroke_fill: tuple[int, int, int, int],
) -> None:
    draw.text(xy, text, font=face, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)


def draw_crown(draw: ImageDraw.ImageDraw, cx: int, top: int, width: int) -> None:
    base = top + int(width * 0.42)
    points = [
        (cx - width // 2, base),
        (cx - width // 2, top + int(width * 0.22)),
        (cx - width // 3, top + int(width * 0.28)),
        (cx - width // 6, top + 4),
        (cx, top + int(width * 0.2)),
        (cx + width // 6, top + 4),
        (cx + width // 3, top + int(width * 0.28)),
        (cx + width // 2, top + int(width * 0.22)),
        (cx + width // 2, base),
    ]
    draw.polygon(points, fill=GOLD)
    draw.rectangle((cx - width // 2, base - 6, cx + width // 2, base + 8), fill=GOLD)
    for x, y in ((cx - width // 6, top + 4), (cx + width // 6, top + 4), (cx, top + int(width * 0.2))):
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=GOLD_DEEP)


def draw_shield(draw: ImageDraw.ImageDraw, cx: int, top: int, width: int, height: int) -> None:
    left = cx - width // 2
    right = cx + width // 2
    mid = top + int(height * 0.62)
    path = [
        (left, top),
        (right, top),
        (right, mid),
        (cx, top + height),
        (left, mid),
    ]
    draw.polygon(path, fill=WHITE)
    draw.line(path + [path[0]], fill=GOLD, width=8)


def draw_mark() -> tuple[Image.Image, Image.Image]:
    script = font(
        "https://github.com/google/fonts/raw/main/ofl/lobster/Lobster-Regular.ttf",
        "Lobster-Regular.ttf",
        150,
    )
    script_small = font(
        "https://github.com/google/fonts/raw/main/ofl/lobster/Lobster-Regular.ttf",
        "Lobster-Regular.ttf",
        78,
    )
    block = font(
        "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
        "Anton-Regular.ttf",
        64,
    )
    canvas = Image.new("RGBA", (1200, 560), (0, 0, 0, 255))
    draw = ImageDraw.Draw(canvas)
    draw_crown(draw, 600, 18, 150)
    draw_shield(draw, 600, 78, 168, 150)
    letters = "SSC"
    width, height = text_size(draw, letters, block)
    stroke_text(draw, (600 - width // 2, 118), letters, block, BLACK, 0, BLACK)
    # Gold speed lines beside the shield, like the source logo.
    draw.rectangle((80, 130, 470, 138), fill=GOLD)
    draw.rectangle((730, 130, 1120, 138), fill=GOLD)
    title = "Stemp's"
    title_w, _ = text_size(draw, title, script)
    stroke_text(draw, ((1200 - title_w) // 2, 250), title, script, WHITE, 6, GOLD)
    sub = "Sports Cards"
    sub_w, _ = text_size(draw, sub, script_small)
    stroke_text(draw, ((1200 - sub_w) // 2, 410), sub, script_small, WHITE, 4, GOLD)
    draw.rectangle((360, 520, 840, 528), fill=GOLD)

    icon = Image.new("RGBA", (512, 512), (0, 0, 0, 255))
    icon_draw = ImageDraw.Draw(icon)
    draw_crown(icon_draw, 256, 54, 210)
    draw_shield(icon_draw, 256, 148, 300, 290)
    icon_font = font(
        "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf",
        "Anton-Regular.ttf",
        108,
    )
    letters_w, _ = text_size(icon_draw, letters, icon_font)
    stroke_text(icon_draw, (256 - letters_w // 2, 230), letters, icon_font, BLACK, 0, BLACK)
    return canvas, icon


def save_icons(icon: Image.Image) -> None:
    square = icon.convert("RGBA")
    if square.width != square.height:
        side = max(square.size)
        framed = Image.new("RGBA", (side, side), (0, 0, 0, 255))
        framed.paste(square, ((side - square.width) // 2, (side - square.height) // 2), square)
        square = framed
    master = square.resize((512, 512), Image.Resampling.LANCZOS)
    master.save(PUBLIC / "icon-512.png")
    master.resize((192, 192), Image.Resampling.LANCZOS).save(PUBLIC / "icon-192.png")
    master.resize((180, 180), Image.Resampling.LANCZOS).save(PUBLIC / "apple-touch-icon.png")
    master.resize((32, 32), Image.Resampling.LANCZOS).save(PUBLIC / "favicon-32.png")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    if SOURCE.exists():
        print(f"cropping {SOURCE}")
        wordmark, icon = crop_source(Image.open(SOURCE))
    else:
        print("no brand/source.png; drawing the black-and-gold SSC mark")
        wordmark, icon = draw_mark()
    # Trim leftover black margins so the header isn't a huge empty frame.
    bbox = wordmark.convert("RGB").point(lambda p: 255 if p > 12 else 0).getbbox()
    if bbox:
        pad = 16
        wordmark = wordmark.crop((
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(wordmark.width, bbox[2] + pad),
            min(wordmark.height, bbox[3] + pad),
        ))
    wordmark.save(PUBLIC / "wordmark.png")
    save_icons(icon)
    print("wrote public/wordmark.png and icons")


if __name__ == "__main__":
    main()
