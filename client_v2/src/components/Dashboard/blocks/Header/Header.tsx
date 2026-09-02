import cn from 'clsx';

import intl from 'panel/common/intl';
import theme from 'panel/lib/theme';
import { Select } from 'panel/common/controls/Select';
import { Icon } from 'panel/common/ui/Icon';
import { Link } from 'panel/common/ui/Link';
import { RoutePath, SCROLL_QUERY_KEY } from 'panel/components/Routes/Paths';
import { useIsMobile } from 'panel/hooks/useIsMobile';

import s from './Header.module.pcss';

export const getPeriodLabel = (interval: number) => {
    const hours = interval / (60 * 60 * 1000);
    if (hours === 24) {
        return intl.getPlural('last_hours', 24);
    }
    const days = hours / 24;
    if (Number.isInteger(days)) {
        if (days === 7) return intl.getPlural('last_days', 7);
        if (days === 30) return intl.getPlural('last_days', 30);
        if (days === 90) return intl.getPlural('last_days', 90);
        return intl.getPlural('last_days', days);
    }
    return intl.getPlural('last_hours', Math.floor(hours));
};

type Props = {
    selectedPeriod: number;
    periodOptions: Array<{ value: number; label: string }>;
    isLoading: boolean;
    onRefreshStats: () => void;
    onPeriodChange: (period: number) => void;
};

export const Header = (props: Props) => {
    const isMobile = useIsMobile();




    const periodSettingsFooter = (
        <div class={cn(s.periodSettingsFooter, theme.select.option_check)}>
            <Icon icon="settings" class={theme.select.icon} />
            <div class={cn(theme.text.t2, theme.text.condenced)}>
                {intl.getMessage('period_notify', {
                    a: (text: string) => (
                        <Link
                            to={RoutePath.SettingsPage}
                            query={{ [SCROLL_QUERY_KEY]: 'statistics' }}
                            class={cn(theme.link.link, theme.link.noDecoration)}
                        >
                            {text}
                        </Link>
                    ),
                })}
            </div>
        </div>
    );

    return (
        <div class={s.header}>
            <div class={s.headerLeft}>
                <div class={s.titleRow}>
                    <h1 class={cn(theme.title.h5, s.onlyMobile)}>{intl.getMessage('dashboard')}</h1>

                    <button
                        type="button"
                        class={cn(s.refreshButton, s.refreshMobileButton, s.onlyMobile)}
                        onClick={() => props.onRefreshStats?.()}
                        disabled={props.isLoading}
                        aria-label={intl.getMessage('refresh_btn')}
                        title={intl.getMessage('refresh_btn')}
                    >
                        <Icon icon="refresh" color="green" />
                    </button>
                </div>

                <h1 class={cn(theme.title.h3_tablet, s.onlyDesktop)}>
                    {intl.getMessage('dashboard')}
                </h1>
            </div>

            <div class={s.headerRight}>
                <button
                    type="button"
                    class={cn(s.refreshButton, s.refreshDesktopButton, s.onlyDesktop)}
                    onClick={() => props.onRefreshStats?.()}
                    disabled={props.isLoading}
                    aria-label={intl.getMessage('refresh_btn')}
                    title={intl.getMessage('refresh_btn')}
                >
                    {intl.getMessage('refresh_statics')}
                    <Icon icon="refresh" color="green" />
                </button>
            </div>

            <div class={s.periodSelect}>
                <Select<number>
                    options={props.periodOptions}
                    value={props.periodOptions.find((o) => o.value === props.selectedPeriod)}
                    onChange={(option: any) => props.onPeriodChange(option.value)}
                    size="responsive"
                    height="big"
                    isSearchable={false}
                    borderless={!isMobile()}
                    menuSize="big"
                    menuPosition="right"
                    menuFooter={periodSettingsFooter}
                />
            </div>
        </div>
    );
};
