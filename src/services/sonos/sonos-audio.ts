export class SonosAudio {
    private _finished = false;
    private _cancelled: boolean;

    get finished(): boolean {
        return this._finished;
    }

    get cancelled(): boolean {
        return this._cancelled;
    }

    constructor(
        public readonly uri: string,
        public readonly length: number,
        public readonly volume?: number,
        private onFinished?: (cancelled: boolean) => void
    ) {}

    finish(cancelled: boolean) {
        if (this._finished) return;
        this._finished = true;
        this._cancelled = cancelled;
        this.onFinished(cancelled);
    }
}
