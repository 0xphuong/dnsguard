import { createMemo } from 'solid-js';

import { accessState } from 'panel/stores/access';
import intl from 'panel/common/intl';
import { SettingRow } from 'panel/common/ui/SettingRow';
import { Section } from 'panel/common/ui/Section';
import { useDialog } from 'panel/hooks/useDialog';
import { getListSummary } from '../helpers';

import { AllowedClientsDialog } from './blocks/AllowedClientsDialog';
import { DisallowedClientsDialog } from './blocks/DisallowedClientsDialog';
import { DisallowedDomainsDialog } from './blocks/DisallowedDomainsDialog';

export const Access = () => {
    const allowedDialog = useDialog();
    const disallowedClientsDialog = useDialog();
    const disallowedDomainsDialog = useDialog();

    const allowedClientsOn = createMemo(() => accessState.allowed_clients.trim().length > 0);
    const processing = () => accessState.processingSet;

    const allowedClientsValue = createMemo(() => getListSummary(accessState.allowed_clients));
    const disallowedClientsValue = createMemo(() => getListSummary(accessState.disallowed_clients));
    const disallowedDomainsValue = createMemo(() => getListSummary(accessState.blocked_hosts));

    return (
        <Section title={intl.getMessage('dns_access_settings_title')}>

            <SettingRow
                variant="link"
                id="allowed_clients"
                title={intl.getMessage('dns_allowed_clients')}
                description={intl.getMessage('dns_allowed_clients_desc')}
                value={allowedClientsValue()}
                valueMono
                onClick={allowedDialog.openDialog}
            />

            <SettingRow
                variant="link"
                id="disallowed_clients"
                title={intl.getMessage('dns_disallowed_clients')}
                description={intl.getMessage('dns_disallowed_clients_desc')}
                value={disallowedClientsValue()}
                valueMono
                disabled={allowedClientsOn()}
                onClick={disallowedClientsDialog.openDialog}
            />

            <SettingRow
                variant="link"
                id="disallowed_domains"
                title={intl.getMessage('dns_disallowed_domains')}
                description={intl.getMessage('dns_disallowed_domains_desc')}
                value={disallowedDomainsValue()}
                valueMono
                onClick={disallowedDomainsDialog.openDialog}
            />

            <AllowedClientsDialog
                open={allowedDialog.open}
                onClose={allowedDialog.closeDialog}
                processing={processing()}
            />

            <DisallowedClientsDialog
                open={disallowedClientsDialog.open}
                onClose={disallowedClientsDialog.closeDialog}
                processing={processing()}
            />

            <DisallowedDomainsDialog
                open={disallowedDomainsDialog.open}
                onClose={disallowedDomainsDialog.closeDialog}
                processing={processing()}
            />
        </Section>
    );
};
