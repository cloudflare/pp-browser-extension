import { uint8ToB64URL } from './util.js';

describe('uint8ToB64URL', () => {
    it('should convert simple arrays', () => {
        const u1 = Uint8Array.from([1]);
        expect(uint8ToB64URL(u1)).toBe('AQ==');
    });

    it('should return an empty string on an empty array', () => {
        const u = new Uint8Array();
        expect(uint8ToB64URL(u)).toBe('');
    });

    it('should return 2 an empty string on an empty array', () => {
        const u = new Uint8Array(16);
        expect(uint8ToB64URL(u)).toBe('AAAAAAAAAAAAAAAAAAAAAA==');
    });
});
