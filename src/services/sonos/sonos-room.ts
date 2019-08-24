import { ISonos } from './sonos.types';
import { SonosDeviceSnapshot } from './sonos-device-snapshot';
import { Helpers as SonosHelpers } from 'sonos';
import promiseTimeout from 'p-timeout';
import { Provider } from '../../utils/provider';
import { SonosAudio } from './sonos-audio';
import { BehaviorSubject } from 'rxjs';
import { filter, take } from 'rxjs/operators';

export class SonosRoom extends Provider {
    private snapshots: SonosDeviceSnapshot[];
    private currentAudio$: BehaviorSubject<SonosAudio> = new BehaviorSubject<SonosAudio>(null);
    private frozen$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    get frozen(): boolean {
        return this.frozen$.value;
    }

    constructor(private name: string, private devices: ISonos[]) {
        super();
    }

    async freeze() {
        if (this.frozen) return this.error('Cannot freeze already frozen room');
        // Take snapshots
        this.snapshots = await Promise.all(this.devices.map(d => SonosDeviceSnapshot.take(d)));
        // Pause devices
        await Promise.all(
            this.devices
                .map((d, i) => ({ device: d, snapshot: this.snapshots[i] }))
                .filter(obj => obj.snapshot.isPlaying)
                .map(obj => obj.device)
                .map(async d => d.pause())
        ).catch(_ => {});
        // Set frozen flag
        this.frozen$.next(true);
    }

    async thaw() {
        if (!this.frozen) return this.error('Cannot thaw room that is not frozen');
        // Wait for audio to finish
        await this.currentAudio$
            .pipe(
                filter(audio => !audio),
                take(1)
            )
            .toPromise();
        // Restore snapshots
        await Promise.all(this.devices.map((d, i) => this.snapshots[i].restore(d)));
        this.snapshots = null;
        // Remove frozen flag
        this.frozen$.next(false);
    }

    async playAudio(audio: SonosAudio) {
        // Wait for freeze
        await this.frozen$
            .pipe(
                filter(f => f),
                take(1)
            )
            .toPromise();
        // Finish current audio prematurely
        if (this.currentAudio$.value) this.currentAudio$.value.finish(true);
        // Set as current audio
        this.currentAudio$.next(audio);
        // Start control of sonos devices
        for (const device of this.devices) {
            // Set volume
            if (audio.volume) await device.setVolume(audio.volume);
            // Set stream
            await device.setAVTransportURI({
                uri: audio.uri,
                metadata: SonosHelpers.GenerateMetadata(audio.uri).metadata
            });
            // Await end of stream
            promiseTimeout(
                new Promise((resolve, reject) => {
                    device.once('PlaybackStopped', m => {
                        resolve(m);
                    });
                }),
                audio.length + 1000
            )
                .catch(() => {})
                .finally(() => {
                    audio.finish(false);
                    this.currentAudio$.next(null);
                });
        }
    }
}
