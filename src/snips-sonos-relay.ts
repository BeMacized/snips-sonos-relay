import { Provider } from './utils/provider';
import { OnInit } from './utils/generic';
import { Injectable } from 'injection-js';
import { AsyncDeviceDiscovery as SonosDiscovery } from 'sonos';
import MQTT, { AsyncMqttClient } from 'async-mqtt';
import express from 'express';
import bodyParser from 'body-parser';
import * as _ from 'lodash';

@Injectable()
export class SnipsSonosRelay extends Provider implements OnInit {
    mqtt: AsyncMqttClient;
    expressApp: express.App;
    sonos: { [name: string]: any[] } = {};
    audioCache: { [audioId: string]: Buffer } = {};
    snipsSiteToSonosZoneMap: { [site: string]: string };

    async onInit() {
        // Verify presence of required env variables
        for (const v of ['MQTT_HOST', 'HTTP_HOST', 'SNIPS_SITE_TO_SONOS_ZONE_MAP'].filter(_v => !process.env[_v])) {
            this.error(`Missing environment variable ${v}. Stopping application.`);
            return process.exit(1);
        }
        // Parse site/zone map
        this.snipsSiteToSonosZoneMap = process.env.SNIPS_SITE_TO_SONOS_ZONE_MAP.split(',')
            .map(l => l.trim())
            .filter(l => l)
            .reduce((acc, e) => {
                const kv = e.split('=').map(v => v.trim());
                if (kv[0] && kv[1]) {
                    acc[kv[0]] = kv[1];
                }
                return acc;
            }, {});
        // Initialise HTTP server
        await this._initExpress();
        // Initialise Sonos Client
        await this._initSonos();
        // Initialise MQTT client
        await this._initMqtt();

        this.info('Initialised');
    }

    _initExpress = async () => {
        // Start express server
        this.info('Setting up HTTP server...');
        this.expressApp = express();
        const expressPort: number = parseInt(process.env.HTTP_PORT || '8080', 10);
        this.expressApp.use(bodyParser.urlencoded({ extended: true }));
        this.expressApp.get('/audio/:id', this._handleAudioHttpRequest);
        this.expressApp.listen(expressPort, () => this.info(`HTTP server now listening on port ${expressPort}`));
    };

    _initMqtt = async () => {
        // Connect to MQTT
        this.info('Connecting to MQTT broker...');
        const mqttUrl = process.env.MQTT_USERNAME
            ? `tcp://${encodeURIComponent(process.env.MQTT_USERNAME)}:${encodeURIComponent(process.env.MQTT_PASSWORD)}@${
                  process.env.MQTT_HOST
              }:${process.env.MQTT_PASSWORD}`
            : `tcp://${process.env.MQTT_HOST}:${process.env.MQTT_PORT || 1883}`;
        try {
            this.mqtt = await MQTT.connectAsync(mqttUrl, {});
        } catch (e) {
            this.error('Could not connect to MQTT broker', e);
            return process.exit(1);
        }
        this.info('Connected to MQTT broker');
        // Subscribe to relevant topic(s)
        await this.mqtt.subscribe('hermes/audioServer/+/playBytes/#');
        // Register MQTT events
        this.mqtt.on('error', this._onMQTTError);
        this.mqtt.on('message', this._onMQTTMessage);
    };

    _initSonos = async () => {
        // Discover Sonos speakers
        this.info(`Discovering Sonos devices... (${process.env.SONOS_SCAN_WINDOW || 10000}ms)`);
        let devices: any[];
        try {
            devices = await new SonosDiscovery().discoverMultiple({ timeout: process.env.SONOS_SCAN_WINDOW || 10000 });
        } catch (e) {
            this.error('Could not find any Sonos devices on your network', e);
            return process.exit(1);
        }
        // Transform results
        this.sonos = await Promise.all(devices.map(device => device.getName().then(name => ({ device, name })))).then(_devices => {
            return Object.entries(_.groupBy(_devices, 'name')).reduce((acc: any, e: any) => {
                acc[e[0]] = e[1].map(d => d.device);
                return acc;
            }, {});
        });
        this.info(`Sonos device discovery complete`);
    };

    _onMQTTError = async e => {
        this.error('MQTT ERROR', e);
    };

    _onMQTTMessage = async (topic: string, message: Buffer, packet) => {
        const myRegexp = /hermes\/audioServer\/(.*)?\/playBytes\/(.*)/g;
        const match = myRegexp.exec(topic);
        if (!match) return;
        const siteId = match[1];
        const playId = match[2] + '.wav';
        this.audioCache[playId] = message;
        setTimeout(() => (this.audioCache[playId] = undefined), 10000);
        this.info(`Received audio for siteId "${siteId}".`);
        this._playSnipsAudio(playId, siteId);
    };

    _handleAudioHttpRequest = async (req, res) => {
        const audio: Buffer = this.audioCache[req.params.id];
        if (!audio) {
            this.debug(`Audio request from ${req.hostname} met with 404.`);
            return res.status(404).send({ error: 'Audio with this id not available' });
        }
        this.debug(`Audio request from ${req.hostname} successful`);
        res.status(200)
            .type('audio/wav; charset=utf-8')
            .send(audio);
    };

    _playSnipsAudio = async (playId: string, siteId: string) => {
        const zone = this.snipsSiteToSonosZoneMap[siteId];
        if (!zone) return this.warn(`No Sonos zone defined for site "${siteId}"`);
        const devices = this.sonos[zone] || [];
        if (!devices.length) return this.warn(`No Sonos devices for Sonos zone "${zone}"`);
        for (const device of devices) {
            this.debug('Playing notification on ' + (await device.getName()));
            const notification = {
                uri: `http://${process.env.HTTP_HOST}:${process.env.HTTP_PORT || 8080}/audio/${playId}`,
                onlyWhenPlaying: false,
                volume: parseInt(process.env.SONOS_VOLUME, 10) || 30
            };
            console.log(notification);
            device.playNotification(notification);
        }
    };
}
