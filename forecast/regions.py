"""Canonical region names shared by datasets, the live API and the map."""
from __future__ import annotations

from typing import Optional

FORECAST_REGIONS = (
    "Вінницька область",
    "Волинська область",
    "Дніпропетровська область",
    "Донецька область",
    "Житомирська область",
    "Закарпатська область",
    "Запорізька область",
    "Івано-Франківська область",
    "Київська область",
    "Кіровоградська область",
    "Львівська область",
    "Миколаївська область",
    "Одеська область",
    "Полтавська область",
    "Рівненська область",
    "Сумська область",
    "Тернопільська область",
    "Харківська область",
    "Херсонська область",
    "Хмельницька область",
    "Черкаська область",
    "Чернівецька область",
    "Чернігівська область",
    "м. Київ",
)

# Occupied territories with a standing alert: drawn on the map, never forecast.
PERMANENT_REGIONS = ("Луганська область", "Автономна Республіка Крим")

WEST_REGIONS = (
    "Закарпатська область",
    "Львівська область",
    "Волинська область",
    "Рівненська область",
    "Тернопільська область",
    "Івано-Франківська область",
    "Чернівецька область",
)

KYIV_CITY = "м. Київ"

_ALIASES = {"Київ": KYIV_CITY, "м.Київ": KYIV_CITY, "Київ місто": KYIV_CITY}
_FORECAST_SET = frozenset(FORECAST_REGIONS)


def canonical_region(name: str) -> Optional[str]:
    """Forecast region for a raw source name, or None if it is not forecast."""
    cleaned = " ".join((name or "").split())
    resolved = _ALIASES.get(cleaned, cleaned)
    return resolved if resolved in _FORECAST_SET else None
