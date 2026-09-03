import { createSignal, createMemo, Show } from 'solid-js';

import {
    dnsConfigState,
    clearDnsCache,
    toggleCacheEnabled,
    toggleOptimisticCaching,
} from 'panel/stores/dnsConfig';
import intl from 'panel/common/intl';
import { Button } from 'panel/common/ui/Button';
import { SettingRow } from 'panel/common/ui/SettingRow';
import { Section } from 'panel/common/ui/Section';
import { ConfirmDialog } from 'panel/common/ui/ConfirmDialog';
import { useDialog } from 'panel/hooks/useDialog';
import { getCacheSizeSummary, getTtlSummary } from '../helpers';

import s from './Cache.module.pcss';
import { CacheInputDialog } from './blocks/CacheInputDialog';

export const Cache = () => {
    const [showClearConfirm, setShowClearConfirm] = createSignal(false);

    const cacheSizeDialog = useDialog();
    const minTtlDialog = useDialog();
    const maxTtlDialog = useDialog();

    const cacheSizeValue = createMemo(() => getCacheSizeSummary(dnsConfigState.cache_size));
    const minTtlValue = createMemo(() => getTtlSummary(dnsConfigState.cache_ttl_min));
    const maxTtlValue = createMemo(() => getTtlSummary(dnsConfigState.cache_ttl_max));

    const processing = () => dnsConfigState.processingSetConfig;

    return (
        <Section
            title={intl.getMessage('dns_cache_title')}
            footer={
                <Button
                    variant="secondary-danger"
                    onClick={() => setShowClearConfirm(true)}
                    class={s.actionButton}
                    compact
                >
                    {intl.getMessage('dns_clear_cache')}
                </Button>
            }
        >
            <SettingRow
                variant="switch"
                id="cache_enabled"
                title={intl.getMessage('enable')}
                description={intl.getMessage('dns_cache_desc')}
                checked={!!dnsConfigState.cache_enabled}
                onChange={() => toggleCacheEnabled()}
            />

            <SettingRow
                variant="link"
                id="cache_size"
                title={intl.getMessage('dns_cache_size')}
                description={intl.getMessage('dns_cache_size_desc')}
                value={cacheSizeValue()}
                valueMono
                disabled={!dnsConfigState.cache_enabled}
                onClick={cacheSizeDialog.openDialog}
            />

            <SettingRow
                variant="link"
                id="override_min_ttl"
                title={intl.getMessage('dns_override_min_ttl')}
                description={intl.getMessage('dns_override_min_ttl_desc')}
                value={minTtlValue()}
                valueMono
                disabled={!dnsConfigState.cache_enabled}
                onClick={minTtlDialog.openDialog}
            />

            <SettingRow
                variant="link"
                id="override_max_ttl"
                title={intl.getMessage('dns_override_max_ttl')}
                description={intl.getMessage('dns_override_max_ttl_desc')}
                value={maxTtlValue()}
                valueMono
                disabled={!dnsConfigState.cache_enabled}
                onClick={maxTtlDialog.openDialog}
            />

            <SettingRow
                variant="switch"
                id="optimistic_caching"
                title={intl.getMessage('dns_optimistic_caching')}
                description={intl.getMessage('dns_optimistic_caching_desc')}
                checked={!!dnsConfigState.cache_optimistic}
                disabled={!dnsConfigState.cache_enabled}
                onChange={() => toggleOptimisticCaching()}
            />


            <Show when={showClearConfirm()}>
                <ConfirmDialog
                    title={intl.getMessage('dns_clear_cache_title')}
                    text={intl.getMessage('dns_clear_cache_desc')}
                    buttonText={intl.getMessage('dns_clear_cache_confirm')}
                    cancelText={intl.getMessage('cancel')}
                    buttonVariant="danger"
                    onClose={() => setShowClearConfirm(false)}
                    onConfirm={() => {
                        clearDnsCache();
                        setShowClearConfirm(false);
                    }}
                />
            </Show>

            <CacheInputDialog
                configKey="cache_size"
                open={cacheSizeDialog.open}
                onClose={cacheSizeDialog.closeDialog}
                processing={processing()}
            />

            <CacheInputDialog
                configKey="cache_ttl_min"
                open={minTtlDialog.open}
                onClose={minTtlDialog.closeDialog}
                processing={processing()}
            />

            <CacheInputDialog
                configKey="cache_ttl_max"
                open={maxTtlDialog.open}
                onClose={maxTtlDialog.closeDialog}
                processing={processing()}
            />
        </Section>
    );
};
