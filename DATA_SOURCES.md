# Data sources

The npm package does not include production weather data. Apache-2.0 applies
to the library code and documentation, not to data loaded by an application.

The planned reference MVP pipeline uses DWD ICON-EU data from:

- Source: https://opendata.dwd.de/weather/nwp/icon-eu/grib/
- Terms: https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise_node.html
- License: CC BY 4.0
- Required attribution:
  `Datenbasis: Deutscher Wetterdienst, Rasterdaten bildlich wiedergegeben`

That transformation will deaccumulate precipitation, convert units,
combines wind components, quantizes values, encodes lossless PNG assets, and
visualizes the result. ICON-EU MVP data is not reprojected or tiled.

Fixtures in this repository are synthetic and are distributed under the
repository's Apache-2.0 license.

Paid sources, non-commercial free tiers, and sources that prohibit derivative
works or redistribution are not accepted by the reference pipeline.
