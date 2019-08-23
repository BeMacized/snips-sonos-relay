import { Injectable } from 'injection-js';
import { Provider } from '../../utils/provider';
import express, { Express } from 'express';
import bodyParser from 'body-parser';

@Injectable()
export class AudioCacheService extends Provider {
    private expressApp: Express;
    private audioCache: { [id: string]: Buffer } = {};

    async onInit() {
        // Verify presence of required env variables
        for (const v of ['HTTP_HOST'].filter(_v => !process.env[_v])) {
            this.error(`Missing environment variable ${v}. Stopping application.`);
            return process.exit(1);
        }
        // Start express server
        this.info('Setting up HTTP server...');
        this.expressApp = express();
        const expressPort: number = parseInt(process.env.HTTP_PORT || '8080', 10);
        this.expressApp.use(bodyParser.urlencoded({ extended: true }));
        this.expressApp.get('/audio/:id', this.handleAudioHttpRequest);
        this.expressApp.listen(expressPort, () => this.info(`HTTP server now listening on port ${expressPort}`));
    }

    cacheAudio(id: string, audio: Buffer): string {
        this.audioCache[id + '.wav'] = audio;
        return `http://${process.env.HTTP_HOST}:${process.env.HTTP_PORT || 8080}/audio/${id}.wav`;
    }

    removeAudio(id: string) {
        this.audioCache[id] = undefined;
    }

    private handleAudioHttpRequest = async (req: express.Request, res: express.Response) => {
        const audio: Buffer = this.audioCache[req.params.id];
        if (!audio) {
            this.debug(`Audio request from ${req.hostname} met with 404.`);
            return res.status(404).send({ error: 'Audio with this id not available' });
        }
        this.debug(`Audio request from ${req.ip} successful`);
        res.writeHead(200, {
            'accept-ranges': 'bytes',
            'Content-Type': 'audio/wav; charset=utf-8',
            'Content-Length': audio.length
        }).end(audio);
    };
}
