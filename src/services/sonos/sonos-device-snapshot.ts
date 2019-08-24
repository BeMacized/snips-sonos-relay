import { ISonos } from './sonos.types';

export class SonosDeviceSnapshot {
    private constructor() {}

    volume: number;
    isPlaying: boolean;
    mediaInfo: any;
    positionInfo: any;
    device: ISonos;

    async restore() {
        await this.device.setVolume(this.volume);
        await this.device.setAVTransportURI({
            uri: this.mediaInfo.CurrentURI,
            metadata: this.mediaInfo.CurrentURIMetaData,
            onlySetUri: true
        });
        if (this.positionInfo.Track > 0) await this.device.selectTrack(this.positionInfo.Track);
        await this.device.avTransportService().Seek({ InstanceID: 0, Unit: 'REL_TIME', Target: this.positionInfo.RelTime });
        if (this.isPlaying) await this.device.play();
    }

    static async take(device: ISonos): Promise<SonosDeviceSnapshot> {
        const snapshot: SonosDeviceSnapshot = new SonosDeviceSnapshot();
        snapshot.device = device;
        const state = await device.getCurrentState();
        snapshot.isPlaying = state === 'playing' || state === 'transitioning';
        snapshot.volume = await device.getVolume();
        snapshot.mediaInfo = await device.avTransportService().GetMediaInfo();
        snapshot.positionInfo = await device.avTransportService().GetPositionInfo();
        return snapshot;
    }
}
