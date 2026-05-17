import React from 'react';

type FeatureMarkProps = {
    className?: string;
    strokeWidth?: number;
};

export const DropsChestIcon: React.FC<FeatureMarkProps> = ({ className, strokeWidth = 1.8 }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        className={className}
        aria-hidden="true"
    >
        <path d="M4.5 10.5h15" />
        <path d="M6 10.5V8.75A3.75 3.75 0 0 1 9.75 5h4.5A3.75 3.75 0 0 1 18 8.75v1.75" />
        <path d="M5 10.5h14v7.25A1.25 1.25 0 0 1 17.75 19H6.25A1.25 1.25 0 0 1 5 17.75V10.5Z" />
        <path d="M12 10.5v3.25" />
        <path d="M10.75 13.75h2.5v2.5h-2.5z" />
    </svg>
);

export const MemeAlertsMark: React.FC<FeatureMarkProps> = ({ className }) => (
    <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md border border-sky-400/35 bg-sky-500/10 font-brand text-[0.7em] font-black leading-none text-sky-200 ${className ?? ''}`}
        aria-hidden="true"
    >
        M
    </span>
);
