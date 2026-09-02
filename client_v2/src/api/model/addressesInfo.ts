import type { NetInterfaces } from './netInterfaces';

/**
 * DNSGuard addresses configuration
 */
export interface AddressesInfo {
    dns_port: number;
    interfaces: NetInterfaces;
    version: string;
    web_port: number;
}
