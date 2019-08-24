import { ISonos } from './sonos.types';
import { SonosNotification } from './sonos-notification';
import { SonosDeviceSnapshot } from './sonos-device-snapshot';
import { Helpers as SonosHelpers } from 'sonos';
import promiseTimeout from 'p-timeout';
import { Provider } from '../../utils/provider';
import sleep from 'sleep-promise';

export class SonosRoom extends Provider {
    private notificationQueue: SonosNotification[] = [];
    private processing = false;
    private snapshots: SonosDeviceSnapshot[];

    constructor(private name: string, private devices: ISonos[]) {
        super();
    }

    async playNotification(notification: SonosNotification) {
        this.notificationQueue.push(notification);
        this.processQueue();
    }

    private async processQueue() {
        // Check if processing
        if (this.processing) return;
        // Lock queue
        this.processing = true;
        // Take snapshots
        this.snapshots = await Promise.all(this.devices.map(d => SonosDeviceSnapshot.take(d)));
        // Stop playing
        await Promise.all(
            this.snapshots
                .filter(s => s.isPlaying)
                .map(s => s.device)
                .map(async d => d.pause())
        ).catch(_ => {});
        // Process queue
        while (this.notificationQueue.length) {
            const notification = this.notificationQueue.splice(0, 1)[0];
            await this.processNotification(notification);
            notification.onFinished();
        }
        await sleep(250);
        // Restore snapshots
        await Promise.all(this.snapshots.map(snapshot => snapshot.restore()));
        this.snapshots = null;
        // Release queue lock
        this.processing = false;
    }

    private async processNotification(notification: SonosNotification) {
        // Start playing
        await Promise.all(
            this.devices.map(async device => {
                try {
                    // Set volume
                    await device.setVolume(notification.volume);
                    // Set stream
                    await device.setAVTransportURI({
                        uri: notification.uri,
                        metadata: SonosHelpers.GenerateMetadata(notification.uri).metadata
                    });
                    // Await end of stream
                    await promiseTimeout(
                        new Promise((resolve, reject) => {
                            device.once('PlaybackStopped', m => {
                                resolve(m);
                            });
                        }),
                        notification.length + 1000
                    ).catch(_ => console.log('woops timed out'));
                } catch (e) {
                    this.error(e);
                }
            })
        );
    }
}
