import { ISonos } from './sonos.types';
import * as winston from "winston";

export class SonosDeviceSnapshot {
    private constructor() {}

    volume: number;
    isPlaying: boolean;
    mediaInfo: any;
    positionInfo: any;

    restore = async (device: ISonos) => {
        await device.setVolume(this.volume);
        await device
            .setAVTransportURI({
                uri: this.mediaInfo.CurrentURI,
                metadata: this.mediaInfo.CurrentURIMetaData,
                onlySetUri: true
            })
            .catch(_ => winston.error('CANNOT RESTORE URI:', _.message));
        if (this.positionInfo.Track > 0) {
            await device.selectTrack(this.positionInfo.Track).catch(_ => console.log('CANNOT RESTORE TRACK:', _.message));
            await device
                .avTransportService()
                .Seek({
                    InstanceID: 0,
                    Unit: 'REL_TIME',
                    Target: this.positionInfo.RelTime
                })
                .catch(_ => winston.error('CANNOT RESTORE SEEK:', _.message));
        }
        if (this.isPlaying) await device.play();
    };

    static async take(device: ISonos): Promise<SonosDeviceSnapshot> {
        const snapshot: SonosDeviceSnapshot = new SonosDeviceSnapshot();
        const state = await device.getCurrentState();
        snapshot.isPlaying = state === 'playing' || state === 'transitioning';
        snapshot.volume = await device.getVolume();
        snapshot.mediaInfo = await device.avTransportService().GetMediaInfo();
        snapshot.positionInfo = await device.avTransportService().GetPositionInfo();
        return snapshot;
    }
}
