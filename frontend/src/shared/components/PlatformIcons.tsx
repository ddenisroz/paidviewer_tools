// src/components/PlatformIcons.tsx
import React from 'react';

interface IconProps {
    width?: string | number;
    height?: string | number;
    className?: string;
    style?: React.CSSProperties;
}

// Иконка Twitch "Glitch" (точная копия с LoginPage)
export const TwitchIcon: React.FC<IconProps> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={props.style?.width || props.width || "20"} 
        height={props.style?.height || props.height || "20"} 
        viewBox="0 0 24 24" 
        fill="currentColor"
        className={props.className}
        style={props.style}
    >
        <path d="M2.149 0l-2.149 4.774v16.452h5.71v3.226h4.774l4.774-4.774h3.816l6.657-6.657v-13.021h-23.581zm20.573 12.131l-3.816 3.816h-3.816l-3.816 3.816v-3.816h-4.774v-13.021h16.222v9.205zm-5.71-6.425h2.387v5.71h-2.387v-5.71zm-4.774 0h2.387v5.71h-2.387v-5.71z"/>
    </svg>
);

// Официальная иконка VK Video из @vkontakte/icons (точная копия с LoginPage)
export const VKIcon: React.FC<IconProps> = (props) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={props.style?.width || props.width || "20"} 
        height={props.style?.height || props.height || "20"} 
        fill="currentColor" 
        viewBox="0 0 20 20" 
        className={props.className}
        style={props.style}
    >
        <path fillRule="evenodd" d="M5 7.6c0-1.96 0-2.94.381-3.689a3.5 3.5 0 0 1 1.53-1.53C7.66 2 8.64 2 10.6 2h.52c2.408 0 3.612 0 4.532.469a4.3 4.3 0 0 1 1.88 1.879C18 5.268 18 6.472 18 8.88v2.24c0 2.408 0 3.612-.469 4.532a4.3 4.3 0 0 1-1.879 1.88c-.92.468-2.124.468-4.532.468h-.52c-1.96 0-2.94 0-3.689-.381a3.5 3.5 0 0 1-1.53-1.53C5 15.34 5 14.36 5 12.4V7.6Zm8.607.971c.789.472 1.183.707 1.317 1.012.116.266.116.57 0 .835-.134.306-.528.541-1.317 1.012l-2.088 1.247c-.825.493-1.237.739-1.576.707a1.04 1.04 0 0 1-.741-.42C9 12.688 9 12.207 9 11.247V8.754c0-.96 0-1.44.202-1.716a1.04 1.04 0 0 1 .74-.42c.34-.032.752.214 1.577.706l2.088 1.247ZM3.5 7.881c0-2.41 0-3.613.469-4.533a4.3 4.3 0 0 1 .736-1.033 3.044 3.044 0 0 0-.357.154 4.3 4.3 0 0 0-1.88 1.879C2 5.268 2 6.472 2 8.88v2.24c0 2.408 0 3.612.469 4.532a4.3 4.3 0 0 0 1.879 1.88c.114.057.232.108.357.153a4.299 4.299 0 0 1-.736-1.033c-.469-.92-.469-2.124-.469-4.532V7.88Z" clipRule="evenodd"/>
    </svg>
);

