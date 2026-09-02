import s from './styles.module.pcss';

type Props = {
    id: string;
};

// Logo renders the DNSGuard wordmark: the badge, then "DNS" in the logo colour
// and "Guard" in the description colour, so both follow the active theme.  The
// id prop keeps the gradient id unique when several logos share a document.
export const Logo = (props: Props) => {
    const id = () => props.id || 'sidebar';

    return (
        <svg
            width="173"
            height="24"
            viewBox="0 0 173 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class={s.logo}
        >
            <rect width="24" height="24" rx="6" fill={`url(#dnsguardMark_${id()})`} />
            <path
                fill="#fff"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M6.75 5.25h4.95a6.75 6.75 0 0 1 0 13.5H6.75V5.25Zm3.08 2.93v7.64h1.87a3.82 3.82 0 0 0 0-7.64H9.83Z"
            />
            <text x="32" y="18" font-size="18" font-weight="700" letter-spacing="-0.4">
                <tspan class={s.logoCompany}>DNS</tspan>
                <tspan class={s.logoProduct}>Guard</tspan>
            </text>
            <defs>
                <linearGradient
                    id={`dnsguardMark_${id()}`}
                    x1="12"
                    y1="0"
                    x2="12"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stop-color="#67B279" />
                    <stop offset="1" stop-color="#589968" />
                </linearGradient>
            </defs>
        </svg>
    );
};
