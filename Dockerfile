FROM ghcr.io/prefix-dev/pixi:latest

COPY pixi.lock pixi.lock
COPY pyproject.toml pyproject.toml
COPY shortmail shortmail
RUN pixi install

ENTRYPOINT ["pixi", "run", "app"]
