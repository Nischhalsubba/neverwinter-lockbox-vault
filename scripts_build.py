import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "lockboxes.json"
PUBLIC_DIR = ROOT / "public"


def theme_for(name: str) -> tuple[str, str, str]:
    palettes = [
        ("#111827", "#7c3aed", "#f5d06f"),
        ("#0b1320", "#0f766e", "#f7c873"),
        ("#17120f", "#b45309", "#f6d68b"),
        ("#11131a", "#be123c", "#f2c96d"),
        ("#08141d", "#0369a1", "#e6c978"),
        ("#151019", "#9333ea", "#f0ca6e"),
        ("#101411", "#3f6212", "#f3d58b"),
        ("#15120c", "#a16207", "#f7dd91"),
    ]
    digest = hashlib.sha256(name.encode("utf-8")).digest()
    return palettes[digest[0] % len(palettes)]


def make_placeholder(entry: dict) -> Path:
    name = entry["name"]
    year = entry["year"]
    image_path = entry["image"]
    target = PUBLIC_DIR / image_path
    target.parent.mkdir(parents=True, exist_ok=True)

    bg, glow, gold = theme_for(name)
    initials = "".join(
        word[0]
        for word in re.findall(r"[A-Za-z0-9]+", name.replace("Lockbox", ""))[:3]
    ).upper() or "NW"
    safe_name = html.escape(name)
    safe_initials = html.escape(initials)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600" role="img" aria-labelledby="title desc">
<title id="title">{safe_name} placeholder artwork</title>
<desc id="desc">Generated community placeholder featuring a fantasy lockbox.</desc>
<defs>
  <radialGradient id="r" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="{glow}" stop-opacity=".62"/><stop offset=".55" stop-color="{bg}" stop-opacity=".86"/><stop offset="1" stop-color="#05070b"/></radialGradient>
  <linearGradient id="chest" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#7b4a24"/><stop offset=".5" stop-color="#3a2417"/><stop offset="1" stop-color="#17100c"/></linearGradient>
  <linearGradient id="metal" x1="0" x2="1"><stop stop-color="{gold}"/><stop offset=".5" stop-color="#8b5b1e"/><stop offset="1" stop-color="#e7c66f"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
</defs>
<rect width="960" height="600" fill="url(#r)"/>
<g opacity=".26" fill="none" stroke="{gold}">
  <circle cx="120" cy="100" r="54"/><circle cx="830" cy="130" r="86"/><path d="M0 470C170 390 330 545 510 455S790 390 960 455"/>
</g>
<ellipse cx="480" cy="465" rx="250" ry="48" fill="{glow}" opacity=".22" filter="url(#blur)"/>
<ellipse cx="480" cy="466" rx="210" ry="31" fill="#000" opacity=".52"/>
<g transform="translate(280 136) scale(.91)">
  <path d="M62 122C66 52 122 12 220 12s154 40 158 110" fill="url(#chest)" stroke="url(#metal)" stroke-width="18"/>
  <rect x="34" y="112" width="372" height="238" rx="24" fill="url(#chest)" stroke="url(#metal)" stroke-width="18"/>
  <path d="M220 16v332M44 205h352" stroke="url(#metal)" stroke-width="16" opacity=".85"/>
  <rect x="180" y="172" width="80" height="102" rx="18" fill="#15100c" stroke="url(#metal)" stroke-width="12"/>
  <circle cx="220" cy="214" r="17" fill="{gold}"/><path d="M220 230v28" stroke="{gold}" stroke-width="13" stroke-linecap="round"/>
</g>
<text x="480" y="84" text-anchor="middle" fill="#fff6d7" font-family="Georgia, serif" font-size="30" letter-spacing="5">NEVERWINTER LOCKBOX</text>
<text x="480" y="522" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="38" font-weight="700">{safe_name}</text>
<text x="480" y="560" text-anchor="middle" fill="#d8c99c" font-family="Arial, sans-serif" font-size="19">COMMUNITY PLACEHOLDER / {year}</text>
<circle cx="838" cy="490" r="54" fill="#080b11" stroke="{gold}" stroke-width="3"/><text x="838" y="505" text-anchor="middle" fill="{gold}" font-family="Georgia, serif" font-size="34" font-weight="700">{safe_initials}</text>
</svg>'''
    target.write_text(svg, encoding="utf-8")
    return target


def main() -> None:
    entries = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    generated = 0

    for entry in entries:
        image = entry.get("image", "")
        if entry.get("imageStatus") != "generated-placeholder" or not image.endswith(".svg"):
            continue
        make_placeholder(entry)
        generated += 1

    print(f"Generated {generated} placeholder covers from {DATA_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
