"""Draw synthetic receipt images with Pillow.

M5 uses it for the four demo receipts shown on GitHub Pages (`--demo`). M6 extends it
with random ground truth for the eval dataset. All businesses are fictional.

    uv run python -m evals.generate_receipts --demo
"""

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WEB_SAMPLES = Path(__file__).parents[3] / "apps" / "web" / "public" / "sample-receipts"
WIDTH = 420
MARGIN = 28
LINE = 26


@dataclass(frozen=True)
class Receipt:
    file_name: str
    header: list[str]
    lines: list[tuple[str, str]]
    total: str
    footer: list[str]
    faded: bool = False


DEMO: list[Receipt] = [
    Receipt(
        "padaria-central.png",
        ["PADARIA CENTRAL LTDA", "Rua das Acacias, 120 - Sao Paulo", "CNPJ 00.000.000/0001-00"],
        [
            ("Pao frances (12 un)", "9,60"),
            ("Cafe com leite x3", "28,50"),
            ("Bolo de milho", "48,30"),
        ],
        "R$ 86,40",
        ["10/11/2026 08:42", "Obrigado pela preferencia!"],
    ),
    Receipt(
        "hotel-aurora.png",
        ["HOTEL AURORA", "Av. Beira-Mar, 2000 - Recife", "Nota fiscal de servico"],
        [
            ("Diaria standard x2", "1.560,00"),
            ("Cafe da manha x2", "180,00"),
            ("Taxa de servico", "110,00"),
        ],
        "R$ 1.850,00",
        ["Check-out 05/11/2026", "Hospede: Ana Souza"],
    ),
    Receipt(
        "voo-horizonte.png",
        ["LINHAS AEREAS HORIZONTE", "Bilhete eletronico", "Localizador QX7TRA"],
        [
            ("GRU -> REC ida/volta", "1.098,00"),
            ("Taxa de embarque", "92,00"),
            ("Bagagem 23kg", "50,00"),
        ],
        "R$ 1.240,00",
        ["Emitido em 03/11/2026", "Passageiro: Bruno Rocha"],
    ),
    Receipt(
        "cupom-ilegivel.png",
        ["MERCADO BOM PRECO", "Cupom fiscal", ""],
        [("Itens diversos", "??,??"), ("Desconto", "-?,??")],
        "R$ ???,??",
        ["??/??/2026", ""],
        faded=True,
    ),
]


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def draw(receipt: Receipt) -> Image.Image:
    rows = len(receipt.header) + len(receipt.lines) + len(receipt.footer) + 5
    image = Image.new("RGB", (WIDTH, MARGIN * 2 + rows * LINE), "#fdfcf7")
    pen = ImageDraw.Draw(image)
    ink = "#9a9a96" if receipt.faded else "#1b1b1b"
    y = MARGIN

    def centered(text: str, size: int = 18) -> None:
        nonlocal y
        width = pen.textlength(text, font=font(size))
        pen.text(((WIDTH - width) / 2, y), text, fill=ink, font=font(size))
        y += LINE

    def row(left: str, right: str, size: int = 17) -> None:
        nonlocal y
        pen.text((MARGIN, y), left, fill=ink, font=font(size))
        width = pen.textlength(right, font=font(size))
        pen.text((WIDTH - MARGIN - width, y), right, fill=ink, font=font(size))
        y += LINE

    for i, text in enumerate(receipt.header):
        centered(text, 22 if i == 0 else 16)
    y += LINE // 2
    pen.line((MARGIN, y, WIDTH - MARGIN, y), fill=ink, width=1)
    y += LINE // 2
    for item, price in receipt.lines:
        row(item, price)
    y += LINE // 2
    pen.line((MARGIN, y, WIDTH - MARGIN, y), fill=ink, width=2)
    y += LINE // 2
    row("TOTAL", receipt.total, 22)
    y += LINE // 2
    for text in receipt.footer:
        centered(text, 15)

    if receipt.faded:
        # Thermal paper that faded and a shaky photo: the hard case for extraction.
        image = image.filter(ImageFilter.GaussianBlur(2.4))
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="write the four demo receipts")
    parser.add_argument("--out", type=Path, default=WEB_SAMPLES)
    args = parser.parse_args()
    if not args.demo:
        parser.error("only --demo exists for now (M6 adds the eval dataset)")
    args.out.mkdir(parents=True, exist_ok=True)
    for receipt in DEMO:
        draw(receipt).save(args.out / receipt.file_name, optimize=True)
        print(f"wrote {args.out / receipt.file_name}")


if __name__ == "__main__":
    main()
