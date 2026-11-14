#!/usr/bin/env python3
"""Temperature summary for the "¿Hará calor en septiembre?" chart.

Reads data/clima-villanueva.json (daily max/min, 15-21 September, last 10 years,
Open-Meteo / ERA5 reanalysis) and writes site/assets/js/clima.js with:
  - per-year values for the chart,
  - a linear trend of the yearly mean on year (OLS, n = 10 years),
  - for 18 September 2027: the fitted value, its 95 % confidence interval
    (uncertainty of the expected value) and a 95 % prediction interval for a
    single day (adds year-to-year and day-to-day variability).

Prediction variance for one day in year x0:
  se_fit^2 + s_between^2 + s_within^2 * (1 - 1/k)
where s_between^2 is the residual variance of the yearly means (it already
contains s_within^2 / k) and k = 7 days per year. t quantile with n - 2 df.

To refresh: update the JSON (same query, new years) and run
  python3 scripts/clima.py
numpy 2.x, scipy 1.x.
"""
import json
from pathlib import Path

import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "clima-villanueva.json"
OUT = ROOT / "site" / "assets" / "js" / "clima.js"
TARGET_YEAR = 2027
TARGET_INDEX = 3  # 18 September inside the 15-21 window

d = json.loads(SRC.read_text())
years = np.array(sorted(int(y) for y in d["years"]))
r1 = lambda x: round(float(x), 1)


def summarise(var):
    X = np.array([d["years"][str(y)][var] for y in years])  # years x days
    n, k = X.shape
    means = X.mean(1)
    s_within2 = X.var(1, ddof=1).mean()
    slope, intercept = np.polyfit(years, means, 1)
    resid = means - (intercept + slope * years)
    s_between2 = resid @ resid / (n - 2)
    sxx = ((years - years.mean()) ** 2).sum()
    tq = stats.t.ppf(0.975, n - 2)
    se_slope = np.sqrt(s_between2 / sxx)
    fit = intercept + slope * TARGET_YEAR
    se_fit2 = s_between2 * (1 / n + (TARGET_YEAR - years.mean()) ** 2 / sxx)
    ci = tq * np.sqrt(se_fit2)
    pi = tq * np.sqrt(se_fit2 + s_between2 + s_within2 * (1 - 1 / k))
    return {
        "days": X.round(1).tolist(),
        "mean": [r1(m) for m in means],
        "day18": [r1(v) for v in X[:, TARGET_INDEX]],
        "overall": r1(X.mean()),
        "lowest": r1(X.min()),
        "highest": r1(X.max()),
        "trend": {
            "intercept": float(intercept),
            "slopePerDecade": r1(slope * 10),
            "slopeCI95PerDecade": [r1((slope - tq * se_slope) * 10), r1((slope + tq * se_slope) * 10)],
            "p": round(float(2 * stats.t.sf(abs(slope / se_slope), n - 2)), 2),
            "slope": float(slope),
        },
        "forecast": {"fit": r1(fit), "ci": [r1(fit - ci), r1(fit + ci)], "pi": [r1(fit - pi), r1(fit + pi)]},
    }


data = {
    "years": years.tolist(),
    "target": TARGET_YEAR,
    "window": d["window"],
    "accessed": d["accessed"],
    "source": d["source"],
    "max": summarise("max"),
    "min": summarise("min"),
}

OUT.write_text(
    "// Generado por scripts/clima.py a partir de data/clima-villanueva.json. No editar a mano.\n"
    f"export const clima = {json.dumps(data, ensure_ascii=False)};\n"
)
for v in ("max", "min"):
    f, t = data[v]["forecast"], data[v]["trend"]
    print(f"{v}: 2027 = {f['fit']} °C, IC95 {f['ci']}, IP95 {f['pi']}; tendencia {t['slopePerDecade']} °C/década {t['slopeCI95PerDecade']} p={t['p']}")
print("→", OUT.relative_to(ROOT))
