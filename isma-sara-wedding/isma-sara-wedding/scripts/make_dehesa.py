"""
Generates the original hero illustration (site/assets/img/dehesa.svg):
an Extremadura dehesa at the end of summer — distant sierra, golden stubble,
holm oaks (encinas) and a pair of white storks.

Deterministic (fixed seed) so the output is reproducible.
Run:  python3 scripts/make_dehesa.py
"""
import math
import random

random.seed(18092027)

W, H = 1600, 1000

# Palette (kept in sync with --tokens in site/assets/css/styles.css)
SKY = "#F4EEE2"
SUN = "#E9D9B4"
SIERRA_FAR = "#D3D5C6"
SIERRA = "#BCC3AE"
HILL = "#A7B193"
STUBBLE = "#E2D2AC"
STUBBLE_LINE = "#D5C298"
MEADOW = "#93A07F"
NEAR = "#6F7C61"
OAK_FAR = "#8C9978"
OAK_MID = "#5F6C52"
OAK_NEAR = "#3F4A37"
INK = "#2B2F26"


def ridge(y0, amp, waves, step=20, phase=None):
    """Smooth horizon line as a sum of sines; returns list of (x, y)."""
    phase = phase or [random.uniform(0, math.tau) for _ in waves]
    pts = []
    for x in range(-40, W + 41, step):
        y = y0
        for (freq, a), ph in zip(waves, phase):
            y += amp * a * math.sin(x / W * math.tau * freq + ph)
        pts.append((x, y))
    return pts


def area_path(pts):
    d = f"M{pts[0][0]:.0f},{H + 10} L{pts[0][0]:.0f},{pts[0][1]:.1f} "
    # Catmull-Rom → cubic Bézier for soft hills
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} "
    d += f"L{pts[-1][0]:.0f},{H + 10} Z"
    return d


def y_at(pts, x):
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        if x1 <= x <= x2:
            t = (x - x1) / (x2 - x1)
            return y1 + t * (y2 - y1)
    return pts[-1][1]


def encina(cx, base_y, size, color):
    """A holm oak: short trunk, broad low dome of overlapping lobes."""
    s = size
    out = []
    trunk_h = s * 0.30
    tw = max(1.5, s * 0.07)
    out.append(
        f'<path d="M{cx - tw:.1f},{base_y:.1f} L{cx - tw * 0.6:.1f},{base_y - trunk_h:.1f} '
        f'L{cx + tw * 0.6:.1f},{base_y - trunk_h:.1f} L{cx + tw:.1f},{base_y:.1f} Z"/>'
    )
    crown_y = base_y - trunk_h - s * 0.18
    width = s * random.uniform(1.25, 1.55)
    lobes = 9 + int(s / 12)
    for i in range(lobes):
        t = i / (lobes - 1)
        lx = cx + (t - 0.5) * width
        # dome profile: taller in the middle, flat underside
        dome = math.sin(t * math.pi)
        ly = crown_y - dome * s * 0.42 + random.uniform(-0.04, 0.04) * s
        r = s * (0.22 + 0.17 * dome) * random.uniform(0.85, 1.15)
        out.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="{r:.1f}"/>')
    # flatten underside a touch so canopies read as "encina", not lollipop
    out.append(
        f'<ellipse cx="{cx:.1f}" cy="{crown_y + s * 0.05:.1f}" rx="{width * 0.52:.1f}" ry="{s * 0.12:.1f}"/>'
    )
    return f'<g fill="{color}">' + "".join(out) + "</g>"


def stork(x, y, scale, flip=False):
    """Flying white stork (oblique view): broad white wings with black flight
    feathers, extended neck, red bill and trailing red legs."""
    sx = -scale if flip else scale
    return f"""
  <g transform="translate({x},{y}) scale({sx:.2f},{scale:.2f})" class="stork">
    <path d="M-30,1 L-52,4 M-30,3 L-51,7" stroke="#B9774E" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M-12,-2 C-16,-16 -26,-30 -40,-42 L-33,-45 L-28,-41 L-22,-44 L-18,-39 L-12,-41 C-4,-28 4,-14 10,-2 Z" fill="#FBF8F1"/>
    <path d="M-40,-42 L-33,-45 L-28,-41 L-22,-44 L-18,-39 L-12,-41 C-6,-31 -1,-22 3,-14 C-1,-20 -8,-28 -16,-34 C-24,-37 -32,-40 -40,-42 Z" fill="{INK}"/>
    <path d="M-34,0 C-24,-5 -6,-6 10,-4 C18,-3 24,-2 30,-2 L44,-3 C46,-2 46,0 44,1 L30,2 C22,4 10,6 -4,6 C-18,6 -28,4 -34,0 Z" fill="#FBF8F1"/>
    <path d="M44,-3 L58,-1 L44,1 Z" fill="#B9774E"/>
    <circle cx="41" cy="-1.4" r="0.9" fill="{INK}"/>
    <path d="M-6,4 C-2,18 8,32 24,44 L31,42 L33,47 L39,45 L38,50 L44,49 C34,34 24,18 16,4 Z" fill="#FBF8F1"/>
    <path d="M24,44 L31,42 L33,47 L39,45 L38,50 L44,49 C38,40 32,30 27,21 C26,28 25,36 24,44 Z" fill="{INK}"/>
  </g>"""


parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="dehesa-t">',
    '<title id="dehesa-t">Ilustración de una dehesa extremeña al final del verano, con encinas, rastrojos dorados y dos cigüeñas en vuelo</title>',
    f'<rect width="{W}" height="{H}" fill="{SKY}"/>',
    f'<circle cx="1170" cy="560" r="120" fill="{SUN}" opacity="0.7" class="sun"/>',
]

far = ridge(585, 26, [(1.2, 1.0), (3.1, 0.45), (7.0, 0.18)])
sierra = ridge(620, 22, [(0.8, 1.0), (2.4, 0.5), (5.5, 0.2)])
hill = ridge(668, 14, [(1.0, 1.0), (2.0, 0.6)])
stubble = ridge(705, 10, [(0.7, 1.0), (1.9, 0.4)])
meadow = ridge(850, 18, [(0.6, 1.0), (1.6, 0.5)])
near = ridge(935, 22, [(0.9, 1.0), (2.2, 0.4)])

parts.append(f'<g class="layer layer-far"><path d="{area_path(far)}" fill="{SIERRA_FAR}"/>')
parts.append(f'<path d="{area_path(sierra)}" fill="{SIERRA}"/></g>')

# distant oaks along the hill line
oaks_far = "".join(
    encina(x, y_at(hill, x) + random.uniform(4, 14), random.uniform(9, 15), OAK_FAR)
    for x in sorted(random.uniform(0, W) for _ in range(46))
)
parts.append(f'<g class="layer layer-hill"><path d="{area_path(hill)}" fill="{HILL}"/>{oaks_far}</g>')

# golden stubble band with faint furrows
furrows = []
for k in range(9):
    yy = 718 + k * 13 + k * k * 1.2
    furrows.append(
        f'<path d="M-40,{yy:.0f} C400,{yy - 6:.0f} 1100,{yy + 8:.0f} 1640,{yy:.0f}" '
        f'stroke="{STUBBLE_LINE}" stroke-width="{1 + k * 0.25:.2f}" fill="none" opacity="0.7"/>'
    )
oaks_mid = "".join(
    encina(x, y_at(stubble, x) + random.uniform(30, 110), random.uniform(22, 40), OAK_MID)
    for x in [70, 260, 520, 640, 980, 1240, 1420, 1540]
)
parts.append(
    f'<g class="layer layer-stubble"><path d="{area_path(stubble)}" fill="{STUBBLE}"/>{"".join(furrows)}{oaks_mid}</g>'
)

oaks_near = (
    encina(140, y_at(meadow, 140) + 26, 120, OAK_NEAR)
    + encina(1395, y_at(meadow, 1395) + 34, 150, OAK_NEAR)
    + encina(1560, y_at(meadow, 1560) + 50, 78, OAK_NEAR)
)
parts.append(f'<g class="layer layer-meadow"><path d="{area_path(meadow)}" fill="{MEADOW}"/>{oaks_near}</g>')
parts.append(f'<g class="layer layer-near"><path d="{area_path(near)}" fill="{NEAR}"/></g>')

parts.append('<g class="storks">' + stork(1010, 300, 1.15) + stork(1130, 352, 0.95) + "</g>")
parts.append("</svg>")

with open("site/assets/img/dehesa.svg", "w", encoding="utf-8") as fh:
    fh.write("\n".join(parts))
print("wrote site/assets/img/dehesa.svg")
