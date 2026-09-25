from __future__ import annotations

from .adsb_dxb import fetch_adsb_dxb
from .dpworld_jeddah import fetch_dpworld_jeddah
from .openflights_routes import fetch_openflights_uae_ksa
from .saudia_freighter import fetch_saudia_freighter
from .loadup_public import fetch_loadup_public
from .bidsfactory_uae import fetch_bidsfactory_uae
from .comtrade_proxy import fetch_comtrade_uae_ksa
from .etimad_visitor import fetch_etimad_visitor
from .nqlyat_trucks import fetch_nqlyat_trucks
from .nqlyat_loads import fetch_nqlyat_loads
from .nqlyat_backhaul_hint import fetch_nqlyat_backhaul_hint
from .freightos_estimate import fetch_freightos_estimate
from .loadme_trucks import fetch_loadme_trucks

ALL_FETCHERS = [
    fetch_saudia_freighter,
    fetch_openflights_uae_ksa,
    fetch_adsb_dxb,
    fetch_dpworld_jeddah,
    fetch_nqlyat_trucks,
    fetch_nqlyat_backhaul_hint,
    fetch_loadme_trucks,
    fetch_freightos_estimate,
]

ALL_DEMAND_FETCHERS = [
    fetch_loadup_public,
    fetch_nqlyat_loads,
    fetch_bidsfactory_uae,
    fetch_comtrade_uae_ksa,
    fetch_etimad_visitor,
]

__all__ = [
    "ALL_FETCHERS",
    "ALL_DEMAND_FETCHERS",
    "fetch_saudia_freighter",
    "fetch_openflights_uae_ksa",
    "fetch_adsb_dxb",
    "fetch_dpworld_jeddah",
    "fetch_nqlyat_trucks",
    "fetch_nqlyat_backhaul_hint",
    "fetch_loadme_trucks",
    "fetch_freightos_estimate",
    "fetch_loadup_public",
    "fetch_nqlyat_loads",
    "fetch_bidsfactory_uae",
    "fetch_comtrade_uae_ksa",
    "fetch_etimad_visitor",
]
