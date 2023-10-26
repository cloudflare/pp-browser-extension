function u8ToB64(u: Uint8Array): string {
    return btoa(String.fromCharCode(...u));
}

function b64ToB64URL(s: string): string {
    return s.replace(/\+/g, '-').replace(/\//g, '_');
}

export function uint8ToB64URL(u: Uint8Array): string {
    return b64ToB64URL(u8ToB64(u));
}

// JavaScript Promise don't expose the current status of the promise
// This extension aims to work exactly like a native Promise (therefore extends) with the addition of getter for the current status
export interface QueryablePromise<T> extends Promise<T> {
    isPending: boolean;
    isFullfilled: boolean;
    isRejected: boolean;
    isResolved: boolean;
}

export function promiseToQueryable<T>(p: Promise<T>): QueryablePromise<T> {
    let _isFullfilled = false;
    let _isRejected = false;
    let _isResolved = false;
    const ret: QueryablePromise<T> = {
        get isPending() {
            return !_isFullfilled;
        },
        get isFullfilled() {
            return _isFullfilled;
        },
        get isRejected() {
            return _isRejected;
        },
        get isResolved() {
            return _isResolved;
        },
        then: p.then,
        catch: p.catch,
        finally: p.finally,
        [Symbol.toStringTag]: p[Symbol.toStringTag],
    };
    p.then((_result) => {
        _isFullfilled = true;
        _isResolved = true;
    }).catch((_error) => {
        _isFullfilled = true;
        _isRejected = true;
    });
    return ret;
}

export function isManifestV3(browser: typeof chrome) {
    return !!browser.declarativeNetRequest;
}
