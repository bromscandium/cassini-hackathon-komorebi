
from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from textwrap import indent
from typing import Any, Dict, List, Tuple

import click
import openeo
import xarray as xr

# Optional plotting libs – guarded import
try:
    import cartopy.crs as ccrs
    import matplotlib.pyplot as plt
except ModuleNotFoundError:  # pragma: no cover
    plt = None  # type: ignore
    ccrs = None  # type: ignore

_LOG = logging.getLogger("copernicus_precip")

###############################################################################
# CONFIGURATION OBJECTS
###############################################################################



def _read_yaml(path: Path) -> Dict[str, Any]:
    with path.open() as fp:
        return yaml.load(fp)


@dataclass
class AOI:
    west: float
    south: float
    east: float
    north: float

    def as_dict(self) -> Dict[str, float]:
        return {
            "west": self.west,
            "south": self.south,
            "east": self.east,
            "north": self.north,
        }


@dataclass
class Thresholds:
    total_7d_mm: float = 150.0  # heavy-rain alert
    spi1_drought: float = -1.5  # SPI drought threshold


@dataclass
class PipelineConfig:
    aoi: AOI
    start_date: datetime
    end_date: datetime
    output_dir: Path
    thresholds: Thresholds = field(default_factory=Thresholds)
    collections: Dict[str, str] = field(
        default_factory=lambda: {
            "hourly": "ECMWF/ERA5_LAND/HOURLY",
        }
    )

    @classmethod
    def from_yaml(cls, path: Path) -> "PipelineConfig":
        cfg = _read_yaml(path)
        aoi_dict = cfg["aoi"]
        thresholds = Thresholds(**cfg.get("thresholds", {}))
        return cls(
            aoi=AOI(**aoi_dict),
            start_date=datetime.fromisoformat(cfg["start_date"]),
            end_date=datetime.fromisoformat(cfg["end_date"]),
            output_dir=Path(cfg["output_dir"]),
            thresholds=thresholds,
        )

###############################################################################
# OPENEO HELPER FUNCTIONS
###############################################################################

def connect_backend() -> openeo.Connection:
    """Authenticate with the openEO Copernicus back-end."""
    _LOG.info("Connecting to openeo.cloud …")
    con = openeo.connect("openeo.cloud").authenticate_oidc()
    _LOG.info("Connected as %s", con.describe_account()["user_id"])
    return con


def build_hourly_cube(
    con: openeo.Connection, cfg: PipelineConfig
) -> openeo.UProcessBuilder:
    """Load hourly ERA5-Land precipitation and clip to AOI/period."""
    _LOG.debug("Loading hourly ERA5-Land cube (%s)", cfg.collections["hourly"])
    cube = con.load_collection(
        collection_id=cfg.collections["hourly"],
        spatial_extent=cfg.aoi.as_dict(),
        temporal_extent=[cfg.start_date.isoformat(), cfg.end_date.isoformat()],
        bands=["tp"],
    )
    # ERA5-Land stores mm/h *in metres*, so multiply by 1000.
    cube = cube.multiply(1000)
    return cube.rename_labels("bands", ["tp"], ["precip_mm"])


def aggregate_temporal(
    cube: openeo.UProcessBuilder, freq: str, reducer: str = "sum"
) -> openeo.UProcessBuilder:
    """Aggregate along temporal dimension with given frequency."""
    return cube.aggregate_temporal_period(freq, reducer=reducer)


def rolling_sum(
    cube: openeo.UProcessBuilder, window: str
) -> openeo.UProcessBuilder:
    """Server-side rolling sum via aggregate_window."""
    return cube.aggregate_window(
        dimension="t",
        window=window,
        reducer="sum",
        boundary="align",
        unit="day",
    )


def compute_spi(
    cube: openeo.UProcessBuilder, scale_months: int
) -> openeo.UProcessBuilder:
    """Very simplified SPI: Z-score vs. climatological mean for same calendar window."""
    # Normalising over the entire cube for demo purposes.
    mean = cube.mean(["t"])
    std = cube.stdev(["t"])
    spi = cube.subtract(mean).divide(std)
    return spi.rename_labels("bands", ["precip_mm"], [f"SPI_{scale_months}M"])

###############################################################################
# LOCAL POST-PROCESSING HELPERS
###############################################################################

def _download_and_open(job: openeo.rest.job.Job, local_path: Path) -> xr.Dataset:
    job.download_results(target=local_path)
    gts = list(local_path.glob("*.tif"))
    if not gts:
        raise RuntimeError("No GeoTIFFs in result")
    _LOG.info("Opening %s", gts[0])
    return xr.open_dataset(gts[0], engine="rasterio")


def _plot_quicklooks(ds: xr.Dataset, outdir: Path) -> None:
    if plt is None:
        _LOG.warning("Matplotlib/cartopy not installed; skipping quicklooks")
        return
    outdir.mkdir(exist_ok=True, parents=True)
    for band in ds.data_vars:
        fig = plt.figure(figsize=(6, 4))
        ax = plt.axes(projection=ccrs.PlateCarree())
        ds[band].isel(time=0).plot.imshow(ax=ax, transform=ccrs.PlateCarree(), cmap="Blues")
        ax.coastlines()
        ax.set_title(band)
        out_file = outdir / f"{band}.png"
        fig.savefig(out_file, dpi=150, bbox_inches="tight")
        plt.close(fig)
        _LOG.debug("Saved quicklook %s", out_file)


def check_thresholds(ds: xr.Dataset, cfg: PipelineConfig) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    if "precip_7d" in ds:
        max7 = float(ds["precip_7d"].max())
        if max7 >= cfg.thresholds.total_7d_mm:
            alerts.append({
                "type": "flood_risk",
                "stat": "total_7d_mm",
                "value": max7,
                "threshold": cfg.thresholds.total_7d_mm,
            })
    if "SPI_1M" in ds:
        min_spi = float(ds["SPI_1M"].min())
        if min_spi <= cfg.thresholds.spi1_drought:
            alerts.append({
                "type": "drought_risk",
                "stat": "SPI_1M",
                "value": min_spi,
                "threshold": cfg.thresholds.spi1_drought,
            })
    return alerts

###############################################################################
# MAIN PIPELINE FUNCTION
###############################################################################

def run_pipeline(cfg_path: Path, plot: bool = True) -> None:
    cfg = PipelineConfig.from_yaml(cfg_path)
    cfg.output_dir.mkdir(exist_ok=True, parents=True)

    con = connect_backend()
    hourly = build_hourly_cube(con, cfg)

    # ============================================================
    # BUILD PROCESS GRAPH
    # ============================================================
    pr_3h = aggregate_temporal(hourly, "3h")
    pr_daily = aggregate_temporal(hourly, "day")
    pr_7d = rolling_sum(pr_daily, window="7")
    pr_monthly = aggregate_temporal(hourly, "month")

    spi_1m = compute_spi(pr_monthly, 1)

    merged = (
        pr_3h.add_dimension("bands", label="precip_3h")
        .merge_cubes(pr_daily.rename_labels("bands", ["precip_mm"], ["precip_1d"]))
        .merge_cubes(pr_7d.rename_labels("bands", ["precip_mm"], ["precip_7d"]))
        .merge_cubes(spi_1m)
    )

    job = merged.save_result(
        format="GTiff",
        options={"overview_levels": 3},
    ).create_job(title="precip-pipeline-demo")

    _LOG.info("Starting job %s", job.job_id)
    job.start_and_wait().raise_if_failed()

    local = cfg.output_dir / f"result_{job.job_id}"
    ds = _download_and_open(job, local)

    # ============================================================
    # ALERTS & QUICKLOOKS
    # ============================================================
    alerts = check_thresholds(ds, cfg)
    if alerts:
        alert_file = cfg.output_dir / f"alerts_{cfg.start_date.date()}_{cfg.end_date.date()}.json"
        alert_file.write_text(json.dumps(alerts, indent=2))
        _LOG.warning("ALERTS triggered – see %s", alert_file)
    else:
        _LOG.info("No thresholds exceeded")

    if plot:
        _plot_quicklooks(ds, cfg.output_dir / "quicklooks")

    _LOG.info("Pipeline completed – outputs in %s", cfg.output_dir)

###############################################################################
# CLI ENTRY POINT
###############################################################################

@click.command()
@click.argument("config", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--no-plot", is_flag=True, help="Skip PNG quicklooks (faster, CI-friendly)")
@click.option("-v", "--verbose", count=True, help="Increase log verbosity (-v or -vv)")
def cli(config: Path, no_plot: bool, verbose: int) -> None:  # pragma: no cover
    """Run the Copernicus precipitation pipeline with CONFIG.yml."""
    logging.basicConfig(
        level=logging.DEBUG if verbose >= 2 else logging.INFO if verbose == 1 else logging.WARNING,
        format="%(levelname).1s %(asctime)s %(name)s │ %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )
    try:
        run_pipeline(config, plot=not no_plot)
    except Exception as exc:
        _LOG.exception("Pipeline failed: %s", exc)
        sys.exit(1)


if __name__ == "__main__":  # pragma: no cover
    cli()