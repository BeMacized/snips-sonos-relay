import { ISonos } from './sonos.types';

export class SonosDeviceSnapshot {
    private constructor() {}

    private volume: number;
    private isPlaying: boolean;
    private mediaInfo: any;
    private positionInfo: any;

    async restore(device: ISonos) {
        await device.setVolume(this.volume);
        await device.setAVTransportURI({ uri: this.mediaInfo.CurrentURI, metadata: this.mediaInfo.CurrentURIMetaData, onlySetUri: true });
        if (this.positionInfo.Track > 0) await device.selectTrack(this.positionInfo.Track);
        await device.avTransportService().Seek({ InstanceID: 0, Unit: 'REL_TIME', Target: this.positionInfo.RelTime })
        if (this.isPlaying) await device.play();
    }

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
