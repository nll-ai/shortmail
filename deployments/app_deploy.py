"""
Modal deployment configuration for the Shortmail application.

This module defines the Modal deployment setup for the Shortmail application,
including the container image configuration, volume setup, and web server
function. It handles the creation of a Debian-based container with all necessary
dependencies installed via pixi, and configures persistent storage through
Modal volumes.
"""

import modal


image = (
    modal.Image.debian_slim()
    .run_commands("apt-get update && apt-get install curl -y")
    .run_commands("curl -fsSL https://pixi.sh/install.sh | sh")
    .add_local_dir("./shortmail", "/usr/local/src/shortmail", copy=True)
    .add_local_file("./pyproject.toml", "/usr/local/src/pyproject.toml", copy=True)
    .add_local_file("./pixi.lock", "/usr/local/src/pixi.lock", copy=True)
    .workdir("/usr/local/src")
    .run_commands("/root/.pixi/bin/pixi install")
)

volume = modal.Volume.from_name("shortmail", create_if_missing=True)

app = modal.App(name="shortmail")


@app.function(
    image=image,
    volumes={"/usr/local/src/data": volume},
    secrets=[modal.Secret.from_name("shortmail")],
)
@modal.web_server(7196, startup_timeout=120)
def run_app():
    """
    Start the Shortmail web application server.

    This function serves as the entry point for the Modal deployment.
    It launches the application using pixi in a subprocess, which allows
    the application to run with all dependencies properly configured.
    The function is decorated to run as a web server on port 7196 with
    the specified container image, persistent volume for data storage,
    and required secrets.

    :return: None
    """
    import subprocess

    subprocess.Popen("/root/.pixi/bin/pixi run app", shell=True)
