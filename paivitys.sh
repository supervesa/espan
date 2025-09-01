#!/bin/bash

# Tämä skripti päivittää netlify.toml-tiedoston, jotta
# paikallinen kehityspalvelin löytää backend-funktiot luotettavasti.

echo "Päivitetään netlify.toml-asetustiedosto..."

cat <<'EOF' > netlify.toml
# Kertoo Netlifylle, mistä kansiosta funktiot löytyvät sekä
# lokaalissa kehityksessä (dev) että julkaisun yhteydessä (build).
[build]
  functions = "netlify/functions"

[dev]
  functions = "netlify/functions"

# Ohjaa selaimen tekemät /api/* -kutsut oikeaan funktioon.
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
EOF

echo "Asetukset päivitetty."
echo "Pysäytä 'netlify dev' (Control + C) ja käynnistä se uudelleen."
echo "Analyysin pitäisi nyt toimia."