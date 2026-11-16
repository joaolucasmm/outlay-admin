"""Assemble docs/media/frames/*.png (captured by apps/web/e2e/demo.e2e.ts) into the README GIF.

    cd services/ai && uv run python ../../scripts/make_demo_gif.py
"""

from pathlib import Path

from PIL import Image

MEDIA = Path(__file__).parents[1] / "docs" / "media"
WIDTH = 960
SECONDS_PER_FRAME = 2.6
COLORS = 128


def main() -> None:
    paths = sorted((MEDIA / "frames").glob("*.png"))
    if not paths:
        raise SystemExit("No frames: run the demo capture first (see apps/web/e2e/demo.e2e.ts).")
    frames = []
    for path in paths:
        with Image.open(path) as image:
            height = round(image.height * WIDTH / image.width)
            small = image.convert("RGB").resize((WIDTH, height), Image.Resampling.LANCZOS)
            frames.append(small.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT))
    out = MEDIA / "demo.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=int(SECONDS_PER_FRAME * 1000),
        loop=0,
        optimize=True,
    )
    print(f"wrote {out} ({out.stat().st_size / 1_000_000:.1f} MB, {len(frames)} frames)")


if __name__ == "__main__":
    main()
