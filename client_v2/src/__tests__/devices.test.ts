import { describe, it, expect } from 'vitest';

import {
    buildDevices,
    matchesFilter,
    summarize,
    BLOCKED_HEAVY_THRESHOLD,
} from 'panel/components/Clients/blocks/DeviceGrid/devices';

describe('buildDevices', () => {
    it('joins the four sources into one card per address', () => {
        const devices = buildDevices({
            clients: [
                {
                    name: 'Office Desktop',
                    ids: ['192.168.0.100', 'aa:bb:cc:11:22:33'],
                    use_global_settings: false,
                    tags: ['device_pc'],
                },
            ],
            autoClients: [
                {
                    ip: '192.168.0.200',
                    name: 'tv.lan',
                    source: 'rDNS',
                    whois_info: { city: 'Hanoi', country: 'VN' },
                },
            ],
            topClients: [
                { name: '192.168.0.100', count: 100 },
                { name: '192.168.0.200', count: 50 },
            ],
            topBlockedClients: [
                { name: '192.168.0.100', count: 20 },
                { name: '192.168.0.200', count: 25 },
            ],
        });

        expect(devices).toHaveLength(2);

        // Busiest first.
        expect(devices[0]).toEqual({
            address: '192.168.0.100',
            name: 'Office Desktop',
            mac: 'aa:bb:cc:11:22:33',
            source: null,
            location: null,
            queries: 100,
            blocked: 20,
            blockedShare: 0.2,
            clientName: 'Office Desktop',
            usesGlobalSettings: false,
            tags: ['device_pc'],
        });

        expect(devices[1]).toEqual({
            address: '192.168.0.200',
            name: 'tv.lan',
            mac: null,
            source: 'rDNS',
            location: 'Hanoi, VN',
            queries: 50,
            blocked: 25,
            blockedShare: 0.5,
            clientName: null,
            usesGlobalSettings: true,
            tags: [],
        });
    });

    it('keeps a MAC identifier out of the address list', () => {
        const devices = buildDevices({
            clients: [{ name: 'Laptop', ids: ['aa:bb:cc:dd:ee:ff'] }],
            autoClients: [],
            topClients: [],
            topBlockedClients: [],
        });

        // A hardware address is not something the resolver counts queries
        // against, so it must not become a card of its own.
        expect(devices).toHaveLength(0);
    });

    it('drops a discovered address that has never queried', () => {
        // /etc/hosts gives the resolver a pile of names — localhost,
        // ip6-allnodes — that no device ever queried through.  They are not
        // part of the network and must not fill the grid.
        const devices = buildDevices({
            clients: [],
            autoClients: [
                { ip: '::1', name: 'localhost', source: 'etc/hosts' },
                { ip: 'ff02::1', name: 'ip6-allnodes', source: 'etc/hosts' },
                { ip: '10.0.0.5', name: 'phone', source: 'rDNS' },
            ],
            topClients: [{ name: '10.0.0.5', count: 3 }],
            topBlockedClients: [],
        });

        expect(devices.map((d) => d.name)).toEqual(['phone']);
    });

    it('keeps a configured client that has sent no queries', () => {
        const devices = buildDevices({
            clients: [{ name: 'Printer', ids: ['192.168.0.9'] }],
            autoClients: [],
            topClients: [],
            topBlockedClients: [],
        });

        expect(devices).toEqual([
            {
                address: '192.168.0.9',
                name: 'Printer',
                mac: null,
                source: null,
                location: null,
                queries: 0,
                blocked: 0,
                blockedShare: null,
                clientName: 'Printer',
                usesGlobalSettings: true,
                tags: [],
            },
        ]);
    });

    it('never reports a share above 100% when the counters disagree', () => {
        const devices = buildDevices({
            clients: [],
            autoClients: [],
            topClients: [{ name: '10.0.0.1', count: 10 }],
            topBlockedClients: [{ name: '10.0.0.1', count: 12 }],
        });

        expect(devices[0].blockedShare).toBe(1);
    });

    it('orders ties by name so the grid does not reshuffle', () => {
        const devices = buildDevices({
            clients: [],
            autoClients: [
                { ip: '10.0.0.2', name: 'beta' },
                { ip: '10.0.0.1', name: 'alpha' },
            ],
            topClients: [
                { name: '10.0.0.1', count: 5 },
                { name: '10.0.0.2', count: 5 },
            ],
            topBlockedClients: [],
        });

        expect(devices.map((d) => d.name)).toEqual(['alpha', 'beta']);
    });
});

describe('matchesFilter', () => {
    const device = (over: Partial<ReturnType<typeof buildDevices>[number]>) =>
        ({
            address: '10.0.0.1',
            name: 'x',
            mac: null,
            source: null,
            location: null,
            queries: 0,
            blocked: 0,
            blockedShare: null,
            clientName: null,
            usesGlobalSettings: true,
            tags: [],
            ...over,
        }) as ReturnType<typeof buildDevices>[number];

    it('matches everything under "all"', () => {
        expect(matchesFilter(device({}), 'all')).toBe(true);
    });

    it('calls a device active only once it has queried', () => {
        expect(matchesFilter(device({ queries: 0 }), 'active')).toBe(false);
        expect(matchesFilter(device({ queries: 1 }), 'active')).toBe(true);
    });

    it('treats the threshold itself as blocked-heavy', () => {
        expect(
            matchesFilter(device({ blockedShare: BLOCKED_HEAVY_THRESHOLD }), 'blocked_heavy'),
        ).toBe(true);
        expect(
            matchesFilter(
                device({ blockedShare: BLOCKED_HEAVY_THRESHOLD - 0.01 }),
                'blocked_heavy',
            ),
        ).toBe(false);
    });

    it('never calls a silent device blocked-heavy', () => {
        expect(matchesFilter(device({ blockedShare: null }), 'blocked_heavy')).toBe(false);
    });

    it('counts a device without a persistent client as unconfigured', () => {
        expect(matchesFilter(device({ clientName: null }), 'unconfigured')).toBe(true);
        expect(matchesFilter(device({ clientName: 'PC' }), 'unconfigured')).toBe(false);
    });
});

describe('summarize', () => {
    it('adds up the grid', () => {
        const devices = buildDevices({
            clients: [],
            autoClients: [],
            topClients: [
                { name: '10.0.0.1', count: 100 },
                { name: '10.0.0.2', count: 100 },
            ],
            topBlockedClients: [
                { name: '10.0.0.1', count: 10 },
                { name: '10.0.0.2', count: 50 },
            ],
        });

        expect(summarize(devices)).toEqual({
            devices: 2,
            queries: 200,
            blockedShare: 0.3,
            blockedHeavy: 1,
        });
    });

    it('reports no share when nothing has queried', () => {
        expect(summarize([])).toEqual({
            devices: 0,
            queries: 0,
            blockedShare: null,
            blockedHeavy: 0,
        });
    });
});
