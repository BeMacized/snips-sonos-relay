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

\begin{table}[]
\begin{tabular}{llll}
\cline{1-2} \cline{4-4}
\multicolumn{1}{|l|}{Env Variable}         & \multicolumn{1}{l|}{Optional}    & \multicolumn{1}{l|}{Default} & \multicolumn{1}{l|}{Description}                                                                                                                                                                                                                                                                                                       \\ \cline{1-2} \cline{4-4} 
\multicolumn{1}{|l|}{\textbf{MQTT\_HOST}}  & \multicolumn{1}{l|}{\textbf{No}} & \multicolumn{1}{l|}{}        & \multicolumn{1}{l|}{The hostname or IP address for the MQTT server used with Snips}                                                                                                                                                                                                                                                    \\ \cline{1-2} \cline{4-4} 
\multicolumn{1}{|l|}{MQTT\_PORT}           & \multicolumn{1}{l|}{Yes}         & \multicolumn{1}{l|}{1883}    & \multicolumn{1}{l|}{The post for the MQTT server used with Snips}                                                                                                                                                                                                                                                                      \\ \cline{1-2} \cline{4-4} 
\multicolumn{1}{|l|}{MQTT\_USERNAME}       & \multicolumn{1}{l|}{Yes}         & \multicolumn{1}{l|}{}        & \multicolumn{1}{l|}{The username to authenticate with the MQTT broker}                                                                                                                                                                                                                                                                 \\ \cline{1-2} \cline{4-4} 
MQTT\_PASSWORD                             & Yes                              &                              & The password to authenticate with the MQTT broker                                                                                                                                                                                                                                                                                      \\
\textbf{HTTP\_HOST}                        & \textbf{No}                      &                              & \begin{tabular}[c]{@{}l@{}}The host that the relay will be reachable on by your Sonos devices.
HTTP\_PORT                                 & Yes                              & 8080                         & \begin{tabular}[c]{@{}l@{}}The port that the relay will be reachable on by your Sonos devices.
SONOS\_VOLUME                              & Yes                              & 30                           & The volume to play the audio from Snips at. Range 0 - 100.                                                                                                                                                                                                                                                                             \\
SONOS\_SCAN\_WINDOW                        & Yes                              & 10000                        & \begin{tabular}[c]{@{}l@{}}The time in milliseconds to spend searching for Sonos devices on start. \\ \\ If it's too short, it might miss a device, but if it's too long you spend more time waiting for the relay to start.\end{tabular}                                                                                              \\
\textbf{SNIPS\_SITE\_TO\_SONOS\_ZONE\_MAP} & \textbf{No}                      &                              & \begin{tabular}[c]{@{}l@{}}The mapping of your snips' site id's (e.g. livingroom, bedroom, kitchen, etc) to Sonos zones.\\ Each entry separates the snips site id from the sonos zone name with a `=` character.\\ Multiple entries are comma separated.\\ e.g. `snipsSiteId1=sonosZoneName1,snipsSiteId2=sonosZoneName2`\end{tabular}
\end{tabular}
\end{table}