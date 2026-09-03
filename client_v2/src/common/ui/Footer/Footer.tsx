import { createSignal, createMemo, For, Show } from 'solid-js';
import cn from 'clsx';

import theme from 'panel/lib/theme';
import { Dropdown } from 'panel/common/ui/Dropdown';
import { Icon } from 'panel/common/ui/Icon';
import intl, { type LocalesType } from 'panel/common/intl';

import { LOCAL_STORAGE_KEYS, LocalStorageHelper } from 'panel/helpers/localStorageHelper';
import { LanguageDropdown } from '../LanguageDropdown/LanguageDropdown';
import { THEMES } from 'panel/helpers/constants';
import { LANGUAGES, LANGUAGE_NAMES } from 'panel/helpers/twosky';
import { setHtmlLangAttr, setUITheme } from 'panel/helpers/helpers';
import {
    changeTheme,
    changeLanguage as changeLanguageAction,
    getVersion,
} from 'panel/stores/dashboard';
import { dashboardState } from 'panel/stores/dashboard';

import s from './styles.module.pcss';
import { Lang } from 'panel/api/model/lang';
import { ProfileInfoTheme } from 'panel/api/model/profileInfoTheme';

export const Footer = () => {
    const currentTheme = () => dashboardState.theme || THEMES.auto;
    const profileName = () => dashboardState.name || '';
    const currentLanguage = () => dashboardState.language || intl.getUILanguage();
    const isLoggedIn = () => profileName() !== '';

    const themeTranslations = createMemo<Record<string, string>>(() => ({
        auto: intl.getMessage('system_theme'),
        dark: intl.getMessage('dark_theme'),
        light: intl.getMessage('light_theme'),
    }));

    const [currentThemeLocal, setCurrentThemeLocal] = createSignal(THEMES.auto);
    const [themeDropdownOpen, setThemeDropdownOpen] = createSignal(false);

    const getYear = () => new Date().getFullYear();

    const getThemeIcon = () => {
        const activeTheme = isLoggedIn() ? currentTheme() : currentThemeLocal();
        if (activeTheme === THEMES.auto) return 'theme_auto';
        if (activeTheme === THEMES.dark) return 'theme_dark';
        return 'theme_light';
    };

    const changeLanguage = async (newLang: Lang) => {
        await intl.changeLanguage(newLang as LocalesType);
        setHtmlLangAttr(newLang);
        LocalStorageHelper.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, newLang);
        try {
            await changeLanguageAction(newLang);
        } catch (error) {
            console.error('Failed to save language preference:', error);
        }
    };

    const onThemeChange = (value: ProfileInfoTheme) => {
        if (isLoggedIn()) {
            changeTheme(value);
        } else {
            setUITheme(value);
            setCurrentThemeLocal(value);
        }
        setThemeDropdownOpen(false);
    };

    return (
        <footer class={s.footer}>
            <div class={s.container}>
                <div class={s.leftGroup}>
                    <div class={s.copyright}>&copy; 2018–{getYear()} DNSGuard</div>

                    <Show when={dashboardState.dnsVersion}>
                        <div class={s.version}>
                            {intl.getMessage('version_number', {
                                value: dashboardState.dnsVersion,
                            })}

                            <Show when={dashboardState.checkUpdateFlag}>
                                <button
                                    type="button"
                                    class={cn(s.checkUpdateBtn, {
                                        [s.checkUpdateBtn_loading]:
                                            dashboardState.processingVersion,
                                    })}
                                    aria-label={intl.getMessage('check_updates_btn')}
                                    disabled={dashboardState.processingVersion}
                                    data-testid="footer-check-updates"
                                    onClick={() => getVersion(true)}
                                >
                                    <Icon
                                        icon={
                                            dashboardState.processingVersion ? 'loader' : 'refresh'
                                        }
                                    />
                                </button>
                            </Show>
                        </div>
                    </Show>
                </div>

                <div class={s.dropdownWrapper}>
                    <Dropdown
                        open={themeDropdownOpen()}
                        onOpenChange={setThemeDropdownOpen}
                        menu={
                            <div class={theme.dropdown.menu}>
                                <For each={Object.values(THEMES) as ProfileInfoTheme[]}>
                                    {(v) => (
                                        <button
                                            type="button"
                                            class={cn(theme.dropdown.item, {
                                                [theme.dropdown.item_active]: currentTheme() === v,
                                            })}
                                            onClick={() => onThemeChange(v)}
                                        >
                                            {themeTranslations()[v]}
                                        </button>
                                    )}
                                </For>
                            </div>
                        }
                        class={s.dropdown}
                        position="bottomRight"
                    >
                        <div class={s.dropdownTrigger}>
                            <Icon icon={getThemeIcon()} class={s.icon} />
                            <span>
                                {
                                    themeTranslations()[
                                        isLoggedIn() ? currentTheme() : currentThemeLocal()
                                    ]
                                }
                            </span>
                        </div>
                    </Dropdown>
                </div>

                <div class={s.dropdownWrapper}>
                    <LanguageDropdown
                        value={currentLanguage()}
                        languages={LANGUAGES}
                        languageNames={LANGUAGE_NAMES}
                        onChange={(lang: Lang) => changeLanguage(lang)}
                        class={s.dropdown}
                        position="bottomRight"
                    />
                </div>
            </div>
        </footer>
    );
};
