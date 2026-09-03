import { createSignal, createMemo, Show, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';

import intl from 'panel/common/intl';
import { ConfirmDialog } from 'panel/common/ui/ConfirmDialog';
import { Tabs } from 'panel/common/ui/Tabs';
import { PageHeader } from 'panel/common/ui/PageHeader';
import { dashboardState, getClients } from 'panel/stores/dashboard';
import { statsState, getStats } from 'panel/stores/stats';
import { clientsState, deleteClient } from 'panel/stores/clients';
import { servicesState, getAllBlockedServices } from 'panel/stores/services';
import { initClientForm, buildFormPayload, updateClientFormField } from 'panel/stores/clientForm';
import type { Client } from 'panel/initialState';
import { linkPathBuilder, RoutePath, Paths } from 'panel/components/Routes/Paths';
import theme from 'panel/lib/theme';
import type { WebService } from './blocks/PersistentClientsTable/ServiceIcons';

import { DeviceGrid } from './blocks/DeviceGrid';
import { PersistentClientsTable } from './blocks/PersistentClientsTable';
import { RuntimeClientsTable } from './blocks/RuntimeClientsTable';
import s from './Clients.module.pcss';
import { PlusButton } from 'panel/common/ui/PlusButton';

const CLIENT_TABS = {
    DEVICES: 'devices',
    PERSISTENT: 'persistent',
    RUNTIME: 'runtime',
} as const;

type ClientTab = (typeof CLIENT_TABS)[keyof typeof CLIENT_TABS];

const isClientTab = (value?: string): value is ClientTab =>
    value === CLIENT_TABS.PERSISTENT || value === CLIENT_TABS.RUNTIME;

export const Clients = () => {
    const navigate = useNavigate();
    const [clientNameToDelete, setClientNameToDelete] = createSignal('');

    const [searchParams, setSearchParams] = useSearchParams<{ tab?: string }>();

    // Devices is the default because it is the only view that answers a
    // question about the traffic; the two tables answer questions about the
    // configuration, which is why they are still here but no longer first.
    const activeTab = createMemo<ClientTab>(() =>
        isClientTab(searchParams.tab) ? searchParams.tab : CLIENT_TABS.DEVICES,
    );

    const handleTabChange = (tabId: string) => {
        setSearchParams({ tab: tabId }, { replace: true });
    };

    onMount(() => {
        getClients();
        getStats();
        getAllBlockedServices();
    });

    const handleAddClient = () => {
        initClientForm(null);
        navigate(Paths.ClientsAdd);
    };

    const handleEditClient = (client: Client) => {
        initClientForm(buildFormPayload(client));
        navigate(
            linkPathBuilder(RoutePath.ClientsEdit, {
                clientName: encodeURIComponent(client.name ?? ''),
            }),
        );
    };

    const handleEditByName = (clientName: string) => {
        const client = (dashboardState.clients || []).find((c) => c.name === clientName);
        if (client) {
            handleEditClient(client);
        }
    };

    /**
     * Adding a client for a device the resolver already knows.  The form is
     * initialised empty — passing a payload would put it in edit mode — and
     * the address is then filled in as the first identifier, which is the only
     * field the operator would otherwise have to copy by hand.
     */
    const handleAddForAddress = (address: string) => {
        initClientForm(null);
        updateClientFormField('ids', [address]);
        navigate(Paths.ClientsAdd);
    };

    const handleDeleteClient = (name: string) => {
        setClientNameToDelete(name);
    };

    const handleDeleteClose = () => {
        setClientNameToDelete('');
    };

    const handleDeleteConfirm = () => {
        deleteClient(clientNameToDelete());
        handleDeleteClose();
    };

    const isLoading = createMemo(
        () => dashboardState.processingClients || statsState.processingStats,
    );

    const serviceMap = createMemo(() => {
        const map = new Map<string, WebService>();
        (servicesState.allServices || []).forEach((svc) => {
            map.set(svc.id, svc as WebService);
        });
        return map;
    });

    return (
        <div class={theme.layout.container}>
            <div class={theme.layout.containerIn}>
                {/* Adding a client applies to every view, so the button
                    belongs to the page rather than to one tab. */}
                <PageHeader
                    titleId="clients-title"
                    title={intl.getMessage('clients')}
                    subtitle={intl.getMessage('clients_page_desc')}
                    actions={
                        <PlusButton onClick={handleAddClient} testId="clients-add-button">
                            {intl.getMessage('clients_add')}
                        </PlusButton>
                    }
                />

                <Tabs
                    activeTab={activeTab()}
                    onTabChange={handleTabChange}
                    class={s.tabs}
                    variant="filled"
                    fullWidth
                    contentClass={s.tabContent}
                    tabs={[
                        {
                            id: CLIENT_TABS.DEVICES,
                            label: intl.getMessage('devices_title'),
                            content: (
                                <>
                                    <div class={s.desc}>{intl.getMessage('devices_desc')}</div>

                                    <DeviceGrid
                                        clients={dashboardState.clients || []}
                                        autoClients={dashboardState.autoClients || []}
                                        topClients={statsState.topClients}
                                        topBlockedClients={statsState.topBlockedClients}
                                        onEdit={handleEditByName}
                                        onAdd={handleAddForAddress}
                                    />
                                </>
                            ),
                        },
                        {
                            id: CLIENT_TABS.PERSISTENT,
                            label: intl.getMessage('clients_title'),
                            content: (
                                <>
                                    <div class={s.desc}>{intl.getMessage('clients_desc')}</div>

                                    {dashboardState.clients?.length > 0 && (
                                        <div class={s.tableSection}>
                                            <PersistentClientsTable
                                                clients={dashboardState.clients || []}
                                                normalizedTopClients={
                                                    statsState.normalizedTopClients
                                                }
                                                loading={isLoading()}
                                                onEdit={handleEditClient}
                                                onDelete={handleDeleteClient}
                                                deleteDisabled={clientsState.processingDeleting}
                                                serviceMap={serviceMap()}
                                            />
                                        </div>
                                    )}
                                </>
                            ),
                        },
                        {
                            id: CLIENT_TABS.RUNTIME,
                            label: intl.getMessage('auto_clients_title'),
                            content: (
                                <>
                                    <div class={s.desc}>{intl.getMessage('auto_clients_desc')}</div>

                                    {dashboardState.autoClients?.length > 0 && (
                                        <div class={s.tableSection}>
                                            <RuntimeClientsTable
                                                autoClients={dashboardState.autoClients || []}
                                                normalizedTopClients={
                                                    statsState.normalizedTopClients
                                                }
                                                loading={isLoading()}
                                            />
                                        </div>
                                    )}
                                </>
                            ),
                        },
                    ]}
                />

                <Show when={clientNameToDelete()}>
                    <ConfirmDialog
                        onClose={handleDeleteClose}
                        onConfirm={handleDeleteConfirm}
                        submitDisabled={clientsState.processingDeleting}
                        buttonText={intl.getMessage('yes_remove')}
                        cancelText={intl.getMessage('cancel')}
                        title={intl.getMessage('clients_remove_title')}
                        text={intl.getMessage('clients_remove_desc', {
                            value: clientNameToDelete(),
                        })}
                        buttonVariant="danger"
                    />
                </Show>
            </div>
        </div>
    );
};
