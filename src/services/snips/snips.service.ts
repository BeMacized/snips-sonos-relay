import { Provider } from '../../utils/provider';
import { Injectable } from 'injection-js';
import { SonosService } from '../sonos/sonos.service';
import MQTT, { AsyncMqttClient } from 'async-mqtt';
import { AudioCacheService } from '../audio-cache/audio-cache.service';
import * as mm from 'music-metadata';

@Injectable()
export class SnipsService extends Provider {
    mqtt: AsyncMqttClient;
    snipsSiteToSonosRoomMap: { [site: string]: string };

    constructor(private sonos: SonosService, private audioCache: AudioCacheService) {
        super();
    }

    async onInit() {
        // Verify presence of required env variables
        for (const v of ['MQTT_HOST', 'SNIPS_SITE_TO_SONOS_ROOM_MAP'].filter(_v => !process.env[_v])) {
            this.error(`Missing environment variable ${v}. Stopping application.`);
            return process.exit(1);
        }
        // Parse site/zone map
        this.snipsSiteToSonosRoomMap = process.env.SNIPS_SITE_TO_SONOS_ROOM_MAP.split(',')
            .map(l => l.trim())
            .filter(l => l)
            .reduce((acc, e) => {
                const kv = e.split('=').map(v => v.trim());
                if (kv[0] && kv[1]) {
                    acc[kv[0]] = kv[1];
                }
                return acc;
            }, {});
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
    }

    _onMQTTError = async e => {
        this.error('MQTT ERROR', e);
    };

    _onMQTTMessage = async (topic: string, message: Buffer) => {
        // Parse data from topic
        const myRegexp = /hermes\/audioServer\/(.*)?\/playBytes\/(.*)/g;
        const match = myRegexp.exec(topic);
        if (!match) return;
        const siteId = match[1];
        const playId = match[2];
        // Get sonos room
        const roomName = this.snipsSiteToSonosRoomMap[siteId];
        if (!roomName) return this.warn(`No Sonos room defined for Snips site "${siteId}"`);
        const room = this.sonos.rooms[roomName];
        if (!room) return this.warn('No Sonos devices found for room', room);
        // Cache audio
        const uri = this.audioCache.cacheAudio(playId, message);
        // Figure out length of audio
        const length = Math.ceil((await mm.parseBuffer(message, 'audio/wav')).format.duration * 1000);
        // Play notification
        await room.playNotification({
            uri,
            length,
            volume: parseInt(process.env.SONOS_VOLUME, 10) || 30,
            onFinished: () => this.audioCache.removeAudio(playId)
        });
    };
}
