# Snips Sonos Relay

Relay for redirecting audio output from [Snips](https://snips.ai/) AI devices to [Sonos](https://www.sonos.com) smart speakers.

## Getting started

Docker and Docker Compose are not absolutely required, you can take a different approach.
However, as this is my personal approach, this is how it is explained. 

### Docker Compose entry

Add the following to your `docker-compose.yml`. The environment variables are explained below this example.

**Note:** In order for the relay to be able to discover your Sonos devices, the container has to run in network_mode `host`.

```yaml
version: '3',
services:
    ...
    snips-sonos-relay:
        image: bemacized/snips-sonos-relay:latest
        container_name: snips-sonos-relay
        restart: unless-stopped
        network_mode: host
        environment:
          - MQTT_HOST=snips_mqtt_host
          - HTTP_HOST=192.168.1.3
          - SNIPS_SITE_TO_SONOS_ZONE_MAP=livingroom=Living Room
```


### Environment Variables
| Env Variable                 | Optional | Default | Description                                                                                                                                                                                                                                                                               |
|------------------------------|----------|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SNIPS_SITE_TO_SONOS_ZONE_MAP | No       |         | The mapping of your snips' site id's (e.g. livingroom, bedroom, kitchen, etc) to Sonos zones. Each entry separates the snips site id from the sonos zone name with a `=` character. Multiple entries are comma separated. e.g. `snipsSiteId1=sonosZoneName1,snipsSiteId2=sonosZoneName2`  |
| MQTT_HOST                    | No       |         | The hostname or IP address for the MQTT server used with Snips                                                                                                                                                                                                                            |
| HTTP_HOST                    | No       |         | The host that your Sonos devices will be able to reach the relay on.                                                                                                                                                                                                                      |
| HTTP_PORT                    | Yes      | 8080    | The port that your Sonos devices will be able to reach the relay on.                                                                                                                                                                                                                      |
| MQTT_PORT                    | Yes      | 1883    | The post for the MQTT server used with Snips                                                                                                                                                                                                                                              |
| MQTT_USERNAME                | Yes      |         | The username to authenticate with the MQTT broker                                                                                                                                                                                                                                         |
| MQTT_PASSWORD                | Yes      |         | The password to authenticate with the MQTT broker                                                                                                                                                                                                                                         |
| SONOS_VOLUME                 | Yes      | 30      | The volume to play the audio from Snips at. Range 0 - 100.                                                                                                                                                                                                                                |
| SONOS_SCAN_WINDOW            | Yes      | 10000   | The time in milliseconds to spend searching for Sonos devices on start.   If it's too short, it might miss a device, but if it's too long you spend more time waiting for the relay to start.                                                                                             |
