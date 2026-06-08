"""Analysis sandbox entrypoint.

Quick smoke test of the data stack. Run with `uv run main.py`.
"""

from pathlib import Path

import numpy as np
import polars as pl
import seaborn as sns
import matplotlib.pyplot as plt

FIGURES = Path(__file__).parent / "figures"


def make_sample() -> pl.DataFrame:
    """A small reproducible dataset to confirm the toolchain works end to end."""
    rng = np.random.default_rng(42)
    n = 200
    group = rng.choice(["a", "b", "c"], size=n)
    base = {"a": 0.0, "b": 1.5, "c": 3.0}
    value = np.array([base[g] for g in group]) + rng.normal(0, 1, n)
    return pl.DataFrame({"group": group, "value": value})


def main() -> None:
    df = make_sample()
    print(f"polars  {pl.__version__}")
    print(f"numpy   {np.__version__}")
    print(f"seaborn {sns.__version__}")
    print()
    print(
        df.group_by("group")
        .agg(
            pl.len().alias("n"),
            pl.col("value").mean().round(3).alias("mean"),
            pl.col("value").std().round(3).alias("std"),
        )
        .sort("group")
    )

    FIGURES.mkdir(exist_ok=True)
    sns.set_theme(style="whitegrid")
    ax = sns.violinplot(
        data=df.to_pandas(), x="group", y="value", hue="group", legend=False
    )
    ax.set_title("Sample distribution by group")
    out = FIGURES / "sample.png"
    plt.savefig(out, dpi=120, bbox_inches="tight")
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
