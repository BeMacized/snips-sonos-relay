import { OnInit, Provider } from '../../utils/provider';
import { Injectable } from 'injection-js';
import { AsyncDeviceDiscovery as SonosDiscovery } from 'sonos';
import * as _ from 'lodash';
import { SonosRoom } from './sonos-room';

@Injectable()
export class SonosService extends Provider implements OnInit {
    rooms: { [name: string]: SonosRoom } = {};

    async onInit() {
        await this._discover();
    }

    _discover = async () => {
        // Discover Sonos speakers
        this.info(`Discovering Sonos devices... (${process.env.SONOS_SCAN_WINDOW || 10000}ms)`);
        let devices: any[];
        try {
            devices = await new SonosDiscovery().discoverMultiple({ timeout: process.env.SONOS_SCAN_WINDOW || 10000 });
        } catch (e) {
            this.error('Could not find any Sonos devices on your network', e);
            return process.exit(1);
        }
        this.info(`Discovered ${devices.length} Sonos devices. Gathering device info...`);
        // Transform results
        this.rooms = await Promise.all(devices.map(device => device.getName().then(name => ({ device, name })))).then(_devices => {
            return Object.entries(_.groupBy(_devices, 'name')).reduce((acc: any, e: any) => {
                acc[e[0]] = new SonosRoom(e[0], e[1].map(d => d.device));
                return acc;
            }, {});
        });
        this.info(`Sonos device discovery complete`);
    };
}
