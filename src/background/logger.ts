/* eslint-disable no-console */

import { SERVICE_WORKER_MODE } from '../common';

interface Logger {
    info: (...obj: unknown[]) => void; // Log an info level message
    error: (...obj: unknown[]) => void; // Log an error level message
    debug: (...obj: unknown[]) => void; // Log a debug level message
    warn: (...obj: unknown[]) => void; // Log a Warning level message
    log: (...obj: unknown[]) => void; // Log a message
}

class ConsoleLogger implements Logger {
    public info = (...obj: unknown[]): void => {
        console.info(...obj);
    };

    public error = (...obj: unknown[]): void => {
        console.error(...obj);
    };

    public debug = (...obj: unknown[]): void => {
        console.debug(...obj);
    };

    public warn = (...obj: unknown[]): void => {
        console.warn(...obj);
    };

    public log = (...obj: unknown[]): void => {
        console.log(...obj);
    };
}

class ModeLogger extends ConsoleLogger {
    private static ALLOWED_CALLS: Record<string, SERVICE_WORKER_MODE[]> = {
        INFO: [SERVICE_WORKER_MODE.DEVELOPMENT],
        ERROR: [
            SERVICE_WORKER_MODE.DEMO,
            SERVICE_WORKER_MODE.DEVELOPMENT,
            SERVICE_WORKER_MODE.PRODUCTION,
        ],
        DEBUG: [SERVICE_WORKER_MODE.DEVELOPMENT],
        WARN: [SERVICE_WORKER_MODE.DEVELOPMENT],
        LOG: [
            SERVICE_WORKER_MODE.DEMO,
            SERVICE_WORKER_MODE.DEVELOPMENT,
            SERVICE_WORKER_MODE.PRODUCTION,
        ],
    };

    constructor(public mode: SERVICE_WORKER_MODE) {
        super();
    }

    public info = (...obj: unknown[]): void => {
        if (!ModeLogger.ALLOWED_CALLS.INFO.includes(this.mode)) {
            return;
        }
        console.info(...obj);
    };

    public error = (...obj: unknown[]): void => {
        if (!ModeLogger.ALLOWED_CALLS.ERROR.includes(this.mode)) {
            return;
        }
        console.error(...obj);
    };

    public debug = (...obj: unknown[]): void => {
        if (!ModeLogger.ALLOWED_CALLS.DEBUG.includes(this.mode)) {
            return;
        }
        console.debug(...obj);
    };

    public warn = (...obj: unknown[]): void => {
        if (!ModeLogger.ALLOWED_CALLS.WARN.includes(this.mode)) {
            return;
        }
        console.warn(...obj);
    };

    public log = (...obj: unknown[]): void => {
        if (!ModeLogger.ALLOWED_CALLS.LOG.includes(this.mode)) {
            return;
        }
        console.log(...obj);
    };
}

export function getLogger(mode: SERVICE_WORKER_MODE) {
    return new ModeLogger(mode);
}
