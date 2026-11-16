"""Draw a receipt layout with Pillow. Used by the demo receipts and the eval dataset."""

from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WIDTH = 440
MARGIN = 28
LINE = 26


@dataclass(frozen=True)
class Layout:
    """What is printed, top to bottom. Amounts are already formatted for the locale."""

    header: list[str]
    items: list[tuple[str, str]]
    # Subtotal, tax, tip, TOTAL, cash, change... (label, amount, emphasized).
    summary: list[tuple[str, str, bool]]
    footer: list[str]
    ink: str = "#1b1b1b"
    blur: float = 0.0
    rotate: float = 0.0


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def _printable(layout: Layout) -> None:
    texts = [*layout.header, *layout.footer]
    texts += [t for pair in layout.items for t in pair]
    texts += [t for label, amount, _ in layout.summary for t in (label, amount)]
    bad = sorted({t for t in texts if not t.isascii()})
    if bad:
        # The built-in font would draw a box instead: a silently wrong ground truth.
        raise ValueError(f"Non-ASCII text cannot be drawn: {bad}")


def draw(layout: Layout) -> Image.Image:
    _printable(layout)
    rows = len(layout.header) + len(layout.items) + len(layout.summary) + len(layout.footer) + 5
    image = Image.new("RGB", (WIDTH, MARGIN * 2 + rows * LINE), "#fdfcf7")
    pen = ImageDraw.Draw(image)
    ink = layout.ink
    y = MARGIN

    def centered(text: str, size: int = 18) -> None:
        nonlocal y
        width = pen.textlength(text, font=_font(size))
        pen.text(((WIDTH - width) / 2, y), text, fill=ink, font=_font(size))
        y += LINE

    def row(left: str, right: str, size: int = 17) -> None:
        nonlocal y
        pen.text((MARGIN, y), left, fill=ink, font=_font(size))
        width = pen.textlength(right, font=_font(size))
        pen.text((WIDTH - MARGIN - width, y), right, fill=ink, font=_font(size))
        y += LINE

    def rule(width: int) -> None:
        nonlocal y
        y += LINE // 2
        pen.line((MARGIN, y, WIDTH - MARGIN, y), fill=ink, width=width)
        y += LINE // 2

    for i, text in enumerate(layout.header):
        centered(text, 22 if i == 0 else 16)
    rule(1)
    for item, price in layout.items:
        row(item, price)
    rule(2)
    for label, amount, emphasized in layout.summary:
        row(label, amount, 22 if emphasized else 17)
    y += LINE // 2
    for text in layout.footer:
        centered(text, 15)

    if layout.rotate:
        image = image.rotate(layout.rotate, expand=True, fillcolor="#e9e6dc")
    if layout.blur:
        image = image.filter(ImageFilter.GaussianBlur(layout.blur))
    return image
