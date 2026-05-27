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
                className={`rounded-md border px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-black/30 transition-transform hover:-translate-y-0.5 ${qualityTone(quality)}`}
            >
                {qualityLabel(quality)}
            </button>
        ))}
    </div>
);

export const DropsWidgetOpeningStage: React.FC<{ quality: string; viewerName?: string }> = ({ quality }) => {
    const lootbox = getLootboxImages(quality);
    return (
        <div className="relative mx-auto h-[350px] max-w-[1120px] overflow-visible">
            <div className={`pointer-events-none absolute inset-x-0 top-2 mx-auto h-72 w-72 rounded-full bg-gradient-to-b ${qualityGlowClass(quality)} blur-2xl`} />
            <img
                src={lootbox.closed}
                alt=""
                className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 object-contain drop-shadow-[0_34px_62px_rgba(0,0,0,0.72)]"
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
}> = ({ phase, quality, reelItems, translateX, winnerSlotIndex }) => {
    const lootbox = getLootboxImages(quality);
    const chestImage = phase === 'result' ? lootbox.opened : lootbox.closed;

    return (
        <div className="relative mx-auto h-[430px] max-w-[1120px] overflow-visible">
            <div className={`pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-b ${qualityGlowClass(quality)} blur-2xl`} />
            <img
                src={chestImage}
                alt=""
                className={`pointer-events-none absolute left-1/2 top-[-6px] z-20 h-72 w-72 -translate-x-1/2 object-contain drop-shadow-[0_34px_62px_rgba(0,0,0,0.72)] ${
                    phase === 'result' ? 'scale-105' : 'animate-[dropsChestPulse_1250ms_ease-in-out_infinite]'
                }`}
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
                                className={`flex h-[176px] w-[184px] shrink-0 flex-col items-center justify-center rounded-md border bg-[#120821e8] px-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.48)] transition-all duration-300 ${
                                    isWinner
                                        ? 'scale-105 border-fuchsia-300 shadow-[0_0_42px_rgba(217,70,239,0.72)]'
                                        : 'border-fuchsia-500/22'
                                }`}
                            >
                                <div className="max-w-[150px] truncate text-lg font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                                    {rewardName}
                                </div>
                                {formatChance(item.dropChance) ? (
                                    <div className="mt-4 inline-flex items-center gap-2 text-base font-semibold text-white/86">
                                        <span className="h-3 w-3 rounded-full bg-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.9)]" />
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

export const DropsWidgetResultPanel: React.FC<{ reward: DropsWidgetRewardDataVisual; quality: string }> = ({ reward, quality }) => (
    <div className="pointer-events-none mx-auto mt-2 flex max-w-[620px] flex-col items-center text-center text-white">
        <div className={`rounded-md border px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${qualityTone(quality)}`}>
            {qualityLabel(quality)}
        </div>
        <div className="mt-2 max-w-[620px] truncate px-6 py-2 text-3xl font-black drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)]">
            {reward.reward_name || 'Reward'}
        </div>
        {reward.description ? <p className="mt-1 max-w-[560px] text-sm font-semibold text-white/75">{reward.description}</p> : null}
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
