# Snips Sonos Relay

Relay for redirecting audio output from [Snips](https://snips.ai/) AI devices to [Sonos](https://www.sonos.com) smart speakers.

## Getting started

The following guide explains how to set up this application with [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).
You do not absolutely require either, you can absolutely take a different approach.
However, As this is imo the easiest approach, I will continue with these tools.

### Installation

1. Make sure some recent version of [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) are installed on the target device.
   This can also be one of the same devices that you run Snips on.
   
3. Create a new `docker-compose.yml` (or add the service to your existing docker compose file):

    ```yaml
version: '3'
services:
     snips-sonos-relay:
        # The path to the  
        container_name: snips-sonos-relay
        restart: unless-stopped
    ```

4. Run the application with 
     ```bash
    $ docker-compose up -d
    ```

