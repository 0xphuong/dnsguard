import React, { memo } from 'react';

type Props = {
    className?: string;
};

// Logo renders the DNSGuard wordmark.  The text inherits currentColor so the
// callers' themes keep working; only the badge carries a fixed gradient.
export const Logo = memo(({ className }: Props) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="164"
            height="41"
            viewBox="0 0 164 41"
            fill="none"
            className={className}
        >
            <rect y="4" width="33" height="33" rx="8" fill="url(#dnsguardLogoMark)" />
            <path
                fill="#fff"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.28 11.28h6.81a9.28 9.28 0 0 1 0 18.56H9.28V11.28Zm4.23 4.02v10.5h2.58a5.25 5.25 0 0 0 0-10.5h-2.58Z"
            />
            <text x="43" y="28" fontSize="24" fontWeight="700" letterSpacing="-0.5">
                <tspan fill="#67B279">DNS</tspan>
                <tspan fill="currentColor">Guard</tspan>
            </text>
            <defs>
                <linearGradient
                    id="dnsguardLogoMark"
                    x1="16.5"
                    y1="4"
                    x2="16.5"
                    y2="37"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#67B279" />
                    <stop offset="1" stopColor="#589968" />
                </linearGradient>
            </defs>
        </svg>
    );
});

Logo.displayName = 'Logo';
