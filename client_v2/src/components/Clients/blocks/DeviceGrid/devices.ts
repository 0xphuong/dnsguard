import type { Client } from 'panel/api/model/client';
import type { ClientAuto } from 'panel/api/model/clientAuto';

/**
 * Builds the device-first view of the network out of the four sources that
 * each hold part of the answer:
 *
 *   - persistent clients (`/clients`)      — names, identifiers, settings
 *   - runtime clients (`/clients`)         — what the resolver discovered
 *   - top clients (`/stats`)               — query volume per address
 *   - top blocked clients (`/stats`)       — blocked volume per address
 *
 * The last of those did not exist before: the resolver counted blocked
 * queries per *domain* only, so a device's blocked share was untracked rather
 * than merely unexposed.  See `blockedClients` in `internal/stats/unit.go`.
 *
 * A "device" here is one address the resolver counts queries against, which is
 * why a persistent client covering several identifiers appears as several
 * cards: the statistics are per address, and merging them would report numbers
 * the server never measured.
 */

/** A configured identifier that looks like a hardware address. */
const MAC_RE = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

/** Blocked share at or above which a device is called blocked-heavy. */
export const BLOCKED_HEAVY_THRESHOLD = 0.3;

export type Device = {
    /** The address the resolver counts queries against.  Unique per card. */
    address: string;

    /** Best available label: client name, discovered name, or the address. */
    name: string;

    /** Hardware address, when one was configured as an identifier. */
    mac: string | null;

    /** How the runtime client was discovered — rDNS, DHCP, ARP, WHOIS. */
    source: string | null;

    /** City and country from WHOIS, when the resolver has them. */
    location: string | null;

    queries: number;
    blocked: number;

    /** Blocked fraction of this device's queries.  Null with no queries. */
    blockedShare: number | null;

    /** Name of the persistent client covering this address, if any. */
    clientName: string | null;

    /** Whether that client leaves filtering to the global settings. */
    usesGlobalSettings: boolean;

    tags: string[];
};

type TopStat = {
    name: string;
    count: number;
};

type Input = {
    clients: Client[];
    autoClients: ClientAuto[];
    topClients: TopStat[];
    topBlockedClients: TopStat[];
};

const toCounts = (stats: TopStat[]): Map<string, number> =>
    new Map(stats.map((stat) => [stat.name, stat.count]));

const location = (client?: ClientAuto): string | null => {
    const parts = [client?.whois_info?.city, client?.whois_info?.country].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : null;
};

export const buildDevices = (input: Input): Device[] => {
    const queries = toCounts(input.topClients);
    const blocked = toCounts(input.topBlockedClients);

    const autoByIp = new Map<string, ClientAuto>();
    input.autoClients.forEach((client) => {
        if (client.ip) {
            autoByIp.set(client.ip, client);
        }
    });

    /**
     * Which persistent client owns an address.  Only exact identifier matches
     * count: a CIDR or a ClientID prefix would need the resolver's own
     * matching rules, and guessing them here would mislabel devices.
     */
    const ownerByAddress = new Map<string, Client>();
    input.clients.forEach((client) => {
        (client.ids ?? []).forEach((id) => {
            if (!MAC_RE.test(id) && !ownerByAddress.has(id)) {
                ownerByAddress.set(id, client);
            }
        });
    });

    const addresses = new Set<string>([
        ...queries.keys(),
        ...autoByIp.keys(),
        ...ownerByAddress.keys(),
    ]);

    const devices = [...addresses].map((address): Device => {
        const auto = autoByIp.get(address);
        const owner = ownerByAddress.get(address);
        const queryCount = queries.get(address) ?? 0;
        const blockedCount = blocked.get(address) ?? 0;

        return {
            address,
            name: owner?.name || auto?.name || address,
            mac: (owner?.ids ?? []).find((id) => MAC_RE.test(id)) ?? null,
            source: auto?.source || null,
            location: location(auto),
            queries: queryCount,
            blocked: blockedCount,
            // Clamped because the two counters are collected independently and
            // a rounding disagreement must not produce 103%.
            blockedShare: queryCount > 0 ? Math.min(1, blockedCount / queryCount) : null,
            clientName: owner?.name ?? null,
            usesGlobalSettings: owner?.use_global_settings ?? true,
            tags: owner?.tags ?? [],
        };
    });

    return (
        devices
            /*
             * A runtime client the resolver never answered for is not part of
             * the network.  Most of them come from /etc/hosts — localhost,
             * ip6-allnodes, ip6-mcastprefix — and they would otherwise fill
             * the grid with cards that have nothing to report.  A *configured*
             * client with no queries is kept: someone deliberately created it,
             * and its silence is itself worth seeing.
             */
            .filter((device) => device.queries > 0 || device.clientName !== null)
            // Busiest first: the device generating the most traffic is the one
            // whose blocked share matters most.  Ties fall back to the name so
            // the order is stable between refreshes.
            .sort((a, b) => b.queries - a.queries || a.name.localeCompare(b.name))
    );
};

export type DeviceFilter = 'all' | 'active' | 'blocked_heavy' | 'unconfigured';

export const matchesFilter = (device: Device, filter: DeviceFilter): boolean => {
    switch (filter) {
        case 'active':
            return device.queries > 0;
        case 'blocked_heavy':
            return device.blockedShare !== null && device.blockedShare >= BLOCKED_HEAVY_THRESHOLD;
        case 'unconfigured':
            return device.clientName === null;
        default:
            return true;
    }
};

export type DeviceSummary = {
    devices: number;
    queries: number;
    /** Blocked share across every device, 0..1.  Null with no queries. */
    blockedShare: number | null;
    blockedHeavy: number;
};

export const summarize = (devices: Device[]): DeviceSummary => {
    const queries = devices.reduce((sum, device) => sum + device.queries, 0);
    const blocked = devices.reduce((sum, device) => sum + device.blocked, 0);

    return {
        devices: devices.length,
        queries,
        blockedShare: queries > 0 ? Math.min(1, blocked / queries) : null,
        blockedHeavy: devices.filter((device) => matchesFilter(device, 'blocked_heavy')).length,
    };
};
