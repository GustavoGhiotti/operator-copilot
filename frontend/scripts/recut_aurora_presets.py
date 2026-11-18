"""Recorta os 50 visuais da Aurora a partir das folhas de conceito.

Os presets antigos foram recortados por uma chave de cor que estourava o brilho
do cabelo para branco: sobravam listras brancas opacas ao lado do pescoco e um
contorno esbranquicado na silhueta. Como esse branco fica gravado no RGB, nao da
para remover depois - a arte de origem em concepts/ nao tem branco nenhum ali, e
so ela permite um recorte limpo.

Por isso este script parte sempre da folha de conceito, nunca do preset ja
gerado. Dois pontos importam:

- Segmenta a celula crua, com o fundo navy original. Achatar sobre branco antes
  de segmentar foi o que criou o problema: a franja resultante fica branca. Como
  o navy da arte e quase o mesmo `#08192c` dos tiles da Arena, manter a cor
  composta da borda ja da o resultado certo, sem despremultiplicar.
- Em roupa muito escura o modelo perde as pernas (o look 35 e o caso). Quando a
  silhueta sai pequena demais, a mascara do modelo e unida a uma chave por
  gradiente, que pega tecido escuro, e a sombra do chao e aparada.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy.ndimage import binary_closing, binary_dilation, binary_fill_holes, label

SHEETS = [
    "aurora-looks-basicos-01-10-v1.png",
    "aurora-looks-raros-11-20-v1.png",
    "aurora-looks-epicos-21-30-v1.png",
    "aurora-looks-lendarios-31-40-v1.png",
    "aurora-looks-elite-41-50-v1.png",
]
MODEL = "u2net_human_seg"
CANVAS = (576, 1024)
FIGURE_HEIGHT = 880
FIGURE_TOP = 52
# Abaixo disso a segmentacao claramente comeu parte da roupa.
MIN_OPAQUE_RATIO = 0.18


def sheet_cell(concepts: Path, numero: int) -> Image.Image:
    """Recorta a celula do look, sem as linhas de grade nem o rotulo da base."""
    sheet = Image.open(concepts / SHEETS[(numero - 1) // 10]).convert("RGB")
    width, height = sheet.size
    cell_w, cell_h = width / 5, height / 2
    row, col = divmod((numero - 1) % 10, 5)
    return sheet.crop((
        int(col * cell_w) + 7,
        int(row * cell_h) + 7,
        int((col + 1) * cell_w) - 7,
        int(row * cell_h + cell_h * 0.93),
    ))


def gradient_key(pixels: np.ndarray) -> np.ndarray:
    """Alpha pela distancia ao fundo, que na folha tem gradiente."""
    height, width, _ = pixels.shape
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float64)
    yy /= height
    xx /= width
    ring = np.zeros((height, width), bool)
    margin = 14
    ring[:margin, :] = ring[-margin:, :] = ring[:, :margin] = ring[:, -margin:] = True

    basis = np.stack([
        np.ones(height * width), xx.ravel(), yy.ravel(),
        xx.ravel() ** 2, (xx * yy).ravel(), yy.ravel() ** 2,
    ], axis=1)
    background = np.zeros_like(pixels)
    for channel in range(3):
        coef, *_ = np.linalg.lstsq(
            basis[ring.ravel()], pixels[..., channel].ravel()[ring.ravel()], rcond=None
        )
        background[..., channel] = (basis @ coef).reshape(height, width)
    return np.clip((np.linalg.norm(pixels - background, axis=2) - 10) / 28, 0, 1)


def largest_body(mask: np.ndarray) -> np.ndarray:
    solid = binary_fill_holes(binary_closing(mask, np.ones((5, 5))))
    labelled, count = label(solid)
    if count:
        solid = labelled == (np.bincount(labelled.ravel())[1:].argmax() + 1)
    return binary_fill_holes(solid)


def extract(cell: Image.Image, session: object) -> np.ndarray:
    """Alpha da personagem, com o fallback para roupa escura."""
    upscaled = cell.resize((cell.width * 2, cell.height * 2), Image.LANCZOS)
    model = np.asarray(
        remove(upscaled, session=session, post_process_mask=False).convert("RGBA")
    )[..., 3] / 255.0

    alpha = model
    if (model > 0.5).mean() < MIN_OPAQUE_RATIO:
        keyed = gradient_key(np.asarray(upscaled).astype(np.float64))
        alpha = np.maximum(model, np.where(keyed > 0.5, keyed, 0))

    body = largest_body(alpha > 0.55)
    alpha = np.where(binary_dilation(body, iterations=3), np.maximum(alpha, body), 0.0)
    # A chave por gradiente traz a sombra do chao junto; o modelo nunca traz.
    alpha[np.where(model > 0.5)[0].max() + 5:, :] = 0.0
    return alpha


def compose(cell: Image.Image, alpha: np.ndarray) -> Image.Image:
    upscaled = cell.resize((cell.width * 2, cell.height * 2), Image.LANCZOS)
    ys, xs = np.where(alpha > 0.5)
    if len(ys) < 500:
        raise RuntimeError("silhueta vazia")
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()

    rgb = np.asarray(upscaled).astype(np.uint8)[top:bottom + 1, left:right + 1]
    mask = (alpha[top:bottom + 1, left:right + 1] * 255).astype(np.uint8)
    height, width = mask.shape
    scaled_w = max(1, int(round(width * FIGURE_HEIGHT / height)))

    figure = Image.merge("RGBA", (
        *Image.fromarray(rgb).resize((scaled_w, FIGURE_HEIGHT), Image.LANCZOS).split(),
        Image.fromarray(mask).resize((scaled_w, FIGURE_HEIGHT), Image.LANCZOS),
    ))
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.paste(figure, ((CANVAS[0] - scaled_w) // 2, FIGURE_TOP))
    return canvas


def validate(canvas: Image.Image, numero: int) -> None:
    alpha = np.asarray(canvas)[..., 3]
    height, width = alpha.shape
    for y, x in ((0, 0), (0, width - 1), (height - 1, 0), (height - 1, width - 1)):
        if alpha[y, x] != 0:
            raise RuntimeError(f"look-{numero:02d}: fundo opaco alcancou uma quina")
    if (alpha > 128).mean() < 0.10:
        raise RuntimeError(f"look-{numero:02d}: silhueta pequena demais")
    if not ((alpha > 0) & (alpha < 255)).any():
        raise RuntimeError(f"look-{numero:02d}: alpha binaria, sem antialiasing")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("concepts", type=Path, help="pasta com as 5 folhas de conceito")
    parser.add_argument("destination", type=Path, help="pasta presets/")
    parser.add_argument("--only", help="lista de numeros, ex: 35 ou 1,2,3")
    args = parser.parse_args()

    numeros = (
        [int(n) for n in args.only.split(",")] if args.only else list(range(1, 51))
    )
    session = new_session(MODEL)
    args.destination.mkdir(parents=True, exist_ok=True)

    for index, numero in enumerate(numeros, start=1):
        cell = sheet_cell(args.concepts, numero)
        canvas = compose(cell, extract(cell, session))
        validate(canvas, numero)
        canvas.save(
            args.destination / f"aurora-look-{numero:02d}.webp",
            format="WEBP", quality=92, method=6, exact=True,
        )
        print(f"[{index:02d}/{len(numeros):02d}] aurora-look-{numero:02d}.webp", flush=True)


if __name__ == "__main__":
    main()
