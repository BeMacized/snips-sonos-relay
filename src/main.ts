import 'reflect-metadata';
import { ReflectiveInjector, Injectable, Provider } from 'injection-js';
import * as winston from 'winston';
import dotenv from 'dotenv';
import { SonosService } from './services/sonos/sonos.service';
import { SnipsService } from './services/snips/snips.service';
import { AudioCacheService } from './services/audio-cache/audio-cache.service';

// Configure dotenv
dotenv.config();

// Configure logging
winston.configure({
    level: 'debug',
    format: winston.format.cli(),
    transports: [
        new winston.transports.Console({
            level: 'debug'
        }),
        new winston.transports.File({
            filename: 'combined.log',
            level: 'info'
        }),
        new winston.transports.File({
            filename: 'errors.log',
            level: 'error'
        })
    ]
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: any) => winston.warn('unhandledRejection ' + error + '\n' + error.stack));

// Define providers
const providers = [SonosService, AudioCacheService, SnipsService] as Provider[];

// Create injector
const injector = ReflectiveInjector.resolveAndCreate(providers);

// Call onInit of providers
(async () => {
    const inits = providers
        .map(provider => injector.get(provider))
        .filter(provider => !!provider.onInit)
        .map(provider => provider.onInit.bind(provider));
    for (const init of inits) await init();
})();
