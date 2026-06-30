import { ChevronDown, Sparkles } from 'lucide-react';

import { getLootboxImages, qualityGlowClass, qualityLabel, qualityTone } from './dropsWidgetAssets';

export { qualityGlowClass, qualityLabel } from './dropsWidgetAssets';

export type DropsWidgetPhase = 'idle' | 'opening' | 'spinning' | 'result';

export interface DropsWidgetRewardVisual {
    name?: string;
    description?: string;
}

export interface DropsWidgetReelItemVisual {
    id: string;
    quality: string;
    reward?: DropsWidgetRewardVisual;
    dropChance?: number;
}

export interface DropsWidgetRewardDataVisual {
    viewer_name?: string;
    reward_name?: string;
    description?: string;
    sound_file?: string | null;
}

const formatChance = (value?: number): string => {
    if (!Number.isFinite(value || 0) || !value) return '';
    if (value < 1) return '<1%';
    return `${value.toFixed(value < 10 ? 1 : 0)}%`;
};

export const DropsWidgetPreviewPanel: React.FC<{
    previewByQuality: Array<{ quality: string; count: number }>;
    status: string;
    onTriggerPreview: (quality: string) => void;
}> = ({ previewByQuality, onTriggerPreview }) => (
    <div className="absolute left-5 top-5 z-20 flex flex-wrap gap-2">
        {previewByQuality.map(({ quality }) => (
            <button
                key={quality}
                type="button"
                onClick={() => onTriggerPreview(quality)}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 ${qualityTone(quality)}`}
            >
                {qualityLabel(quality)}
            </button>
        ))}
    </div>
);

export const DropsWidgetOpeningStage: React.FC<{ quality: string; viewerName?: string; frameColor?: string }> = ({ quality, frameColor }) => {
    const lootbox = getLootboxImages(quality);
    return (
        <div className="relative mx-auto h-[430px] max-w-[1120px] overflow-visible">
            <img
                src={lootbox.closed}
                alt=""
                className="pointer-events-none absolute left-1/2 top-[-6px] h-72 w-72 -translate-x-1/2 object-contain"
                style={frameColor ? { outlineColor: frameColor } : undefined}
            />
        </div>
    );
};

export const DropsWidgetReelStage: React.FC<{
    phase: DropsWidgetPhase;
    quality: string;
    reelItems: DropsWidgetReelItemVisual[];
    translateX: string;
    winnerSlotIndex: number;
    frameColor?: string;
    textColor?: string;
    backgroundColor?: string;
    fontScale?: number;
}> = ({ phase, quality, reelItems, translateX, winnerSlotIndex, frameColor, textColor, backgroundColor, fontScale = 1 }) => {
    const lootbox = getLootboxImages(quality);
    const chestImage = phase === 'result' ? lootbox.opened : lootbox.closed;

    return (
        <div className="relative mx-auto h-[430px] max-w-[1120px] overflow-visible">
            <img
                src={chestImage}
                alt=""
                className={`pointer-events-none absolute left-1/2 top-[-6px] z-20 h-72 w-72 -translate-x-1/2 object-contain ${
                    phase === 'result' ? '' : 'animate-[dropsChestPulse_1250ms_ease-in-out_infinite]'
                }`}
                style={frameColor ? { outlineColor: frameColor } : undefined}
            />

            <div className="absolute inset-x-0 top-[245px] h-[188px] overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-[#050714] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-28 bg-gradient-to-l from-[#050714] to-transparent" />
                <div
                    className="absolute left-0 top-0 z-10 flex h-full items-stretch gap-4"
                    style={{ transform: translateX, willChange: 'transform' }}
                >
                    {reelItems.map((item, index) => {
                        const isWinner = phase === 'result' && index === winnerSlotIndex;
                        const rewardName = item.reward?.name || 'Reward';
                        return (
                            <div
                                key={item.id}
                                className={`flex h-[176px] w-[184px] shrink-0 flex-col items-center justify-center rounded-md border bg-[#120821e8] px-4 text-center transition-colors duration-300 ${
                                    isWinner
                                        ? 'border-fuchsia-300 [animation:dropsWinnerPulse_900ms_ease-in-out_infinite]'
                                        : 'border-fuchsia-500/22'
                                }`}
                                style={{
                                    borderColor: frameColor || undefined,
                                    backgroundColor: backgroundColor ? `${backgroundColor}e8` : undefined,
                                    color: textColor || undefined,
                                }}
                            >
                                <div
                                    className="max-w-[150px] truncate font-black"
                                    style={{
                                        fontSize: `${1.125 * fontScale}rem`,
                                        color: textColor || undefined,
                                    }}
                                >
                                    {rewardName}
                                </div>
                                {formatChance(item.dropChance) ? (
                                    <div
                                        className="mt-4 inline-flex items-center gap-2 font-semibold"
                                        style={{ fontSize: `${1 * fontScale}rem`, color: textColor || undefined }}
                                    >
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: frameColor || undefined }} />
                                        {formatChance(item.dropChance)}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const DropsWidgetResultPanel: React.FC<{
    reward: DropsWidgetRewardDataVisual;
    quality: string;
    textColor?: string;
    fontScale?: number;
}> = ({ reward, quality, textColor, fontScale = 1 }) => (
    <div className="pointer-events-none mx-auto mt-2 flex max-w-[620px] flex-col items-center text-center text-white">
        <div className={`rounded-md border px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${qualityTone(quality)}`}>
            {qualityLabel(quality)}
        </div>
        <div
            className="mt-2 max-w-[620px] truncate px-6 py-2 font-black"
            style={{ color: textColor || undefined, fontSize: `${1.875 * fontScale}rem` }}
        >
            {reward.reward_name || 'Reward'}
        </div>
        {reward.description ? (
            <p className="mt-1 max-w-[560px] text-sm font-semibold" style={{ color: textColor ? `${textColor}cc` : undefined }}>
                {reward.description}
            </p>
        ) : null}
    </div>
);

export const DropsWidgetPreviewBadge: React.FC = () => (
    <div className="absolute bottom-5 left-5 rounded-md border border-white/10 bg-[#0c121dd8] px-3 py-1.5 text-xs font-bold text-white/65 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Test
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
        </div>
    </div>
);
