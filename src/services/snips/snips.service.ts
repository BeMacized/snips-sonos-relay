import { Provider } from '../../utils/provider';
import { Injectable } from 'injection-js';
import { SonosService } from '../sonos/sonos.service';
import MQTT, { AsyncMqttClient } from 'async-mqtt';
import { AudioCacheService } from '../audio-cache/audio-cache.service';
import * as mm from 'music-metadata';
import { SonosAudio } from '../sonos/sonos-audio';
import sleep = require('sleep-promise');

const TOPIC_HOTWORD_DETECTED = 'hermes/hotword/default/detected';
const TOPIC_HOTWORD_READY = 'hermes/hotword/toggleOn';

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
        await this.mqtt.subscribe(TOPIC_HOTWORD_DETECTED);
        await this.mqtt.subscribe(TOPIC_HOTWORD_READY);
        // Register MQTT events
        this.mqtt.on('error', this._onMQTTError);
        this.mqtt.on('message', this._onMQTTMessage);
    }

    _onMQTTError = async e => {
        this.error('MQTT ERROR', e);
    };

    _onMQTTMessage = async (topic: string, message: Buffer) => {
        if (topic === TOPIC_HOTWORD_DETECTED) return this._handleHotwordDetected(JSON.parse(message.toString('utf8')).siteId);
        if (topic === TOPIC_HOTWORD_READY) return this._handleHotwordReady(JSON.parse(message.toString('utf8')).siteId);
        const myRegexp = /hermes\/audioServer\/(.*)?\/playBytes\/(.*)/g;
        const match = myRegexp.exec(topic);
        if (match) return this._handleAudio(match[1], match[2], message);
        this.warn('Unknown message on topic', topic);
    };

    _handleHotwordDetected = async (siteId: string) => {
        this.info('DETECTED', siteId);
        // Get sonos room
        const room = this._getSonosRoomForSiteId(siteId);
        if (!room) return;
        if (!room.frozen) await room.freeze();
    };

    _handleHotwordReady = async (siteId: string) => {
        this.info('READY', siteId);
        // Get sonos room
        const room = this._getSonosRoomForSiteId(siteId);
        if (!room) return;
        await sleep(1000); // Wait a bit before thawing room to account for network delay
        if (room.frozen) await room.thaw();
    };

    _handleAudio = async (siteId: string, playId: string, audio: Buffer) => {
        this.info('AUDIO', siteId);
        // Get sonos room
        const room = this._getSonosRoomForSiteId(siteId);
        if (!room) return;
        // Cache audio
        const uri = this.audioCache.cacheAudio(playId, audio);
        // Figure out length of audio
        const length = Math.ceil((await mm.parseBuffer(audio, 'audio/wav')).format.duration * 1000);
        // Play audio
        const sonosAudio = new SonosAudio(uri, length, parseInt(process.env.SONOS_VOLUME, 10) || 30, cancelled => {
            // For later, if I end up replacing snips-audio-server altogether
            // if (!cancelled) {
            //     this.mqtt.publish(
            //         'hermes/audioServer/' + siteId + '/playFinished',
            //         JSON.stringify({
            //             id: playId,
            //             siteId
            //         })
            //     );
            // }
        });
        await room.playAudio(sonosAudio);
    };

    _getSonosRoomForSiteId(siteId: string) {
        const roomName = this.snipsSiteToSonosRoomMap[siteId];
        if (!roomName) return this.warn(`No Sonos room defined for Snips site "${siteId}"`);
        const room = this.sonos.rooms[roomName];
        if (!room) return this.warn('No Sonos devices found for room', room);
        return room;
    }
}
