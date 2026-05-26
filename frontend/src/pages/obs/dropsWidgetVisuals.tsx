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
}

export interface DropsWidgetRewardDataVisual {
    viewer_name?: string;
    reward_name?: string;
    description?: string;
    sound_file?: string | null;
}

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
                className={`rounded-full border px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-black/30 transition-transform hover:-translate-y-0.5 ${qualityTone(quality)}`}
            >
                {qualityLabel(quality)}
            </button>
        ))}
    </div>
);

export const DropsWidgetOpeningStage: React.FC<{ quality: string; viewerName?: string }> = ({ quality }) => {
    const lootbox = getLootboxImages(quality);
    return (
        <div className="relative flex h-[300px] items-center justify-center">
            <div className={`absolute top-0 rounded-full border px-4 py-1.5 text-sm font-black uppercase tracking-[0.18em] ${qualityTone(quality)}`}>
                {qualityLabel(quality)}
            </div>
            <img
                src={lootbox.closed}
                alt=""
                className="h-60 w-60 object-contain drop-shadow-[0_28px_42px_rgba(0,0,0,0.55)]"
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
        <div className="relative h-[350px] overflow-hidden">
            <div className={`pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-full border px-4 py-1.5 text-sm font-black uppercase tracking-[0.18em] ${qualityTone(quality)}`}>
                {qualityLabel(quality)}
            </div>
            <img
                src={chestImage}
                alt=""
                className="pointer-events-none absolute left-1/2 top-[36px] z-0 h-64 w-64 -translate-x-1/2 object-contain opacity-95 drop-shadow-[0_30px_55px_rgba(0,0,0,0.6)]"
            />
            <div
                className="absolute left-0 top-[122px] z-10 flex items-stretch gap-4"
                style={{ transform: translateX, willChange: 'transform' }}
            >
                {reelItems.map((item, index) => {
                    const isWinner = phase === 'result' && index === winnerSlotIndex;
                    return (
                        <div
                            key={item.id}
                            className={`flex h-[168px] w-[184px] shrink-0 flex-col items-center justify-center rounded-2xl border bg-[#080a10f2] shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition-all duration-300 ${
                                isWinner
                                    ? 'scale-105 border-amber-300 shadow-[0_0_68px_rgba(251,191,36,0.42)]'
                                    : 'border-white/10'
                            }`}
                        >
                            <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border text-5xl font-black ${qualityTone(item.quality)}`}>
                                ?
                            </div>
                            <div className="max-w-[152px] truncate text-center text-base font-black text-white">
                                {isWinner ? item.reward?.name || 'Награда' : '???'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const DropsWidgetResultPanel: React.FC<{ reward: DropsWidgetRewardDataVisual; quality: string }> = ({ reward, quality }) => {
    const lootbox = getLootboxImages(quality);
    return (
        <div className="pointer-events-none mx-auto mt-1 flex max-w-[620px] flex-col items-center text-center text-white">
            <img src={lootbox.opened} alt="" className="h-28 w-28 object-contain drop-shadow-[0_22px_42px_rgba(0,0,0,0.5)]" />
            <div className={`mt-1.5 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${qualityTone(quality)}`}>
                {qualityLabel(quality)}
            </div>
            <div className="mt-2 px-6 py-2 text-3xl font-black drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)]">
                {reward.reward_name || 'Награда'}
            </div>
            {reward.description ? <p className="mt-2 max-w-[560px] text-sm font-semibold text-white/75">{reward.description}</p> : null}
        </div>
    );
};

export const DropsWidgetPreviewBadge: React.FC = () => (
    <div className="absolute bottom-5 left-5 rounded-full border border-white/10 bg-[#0c121dd8] px-3 py-1.5 text-xs font-bold text-white/65 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Тест
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
        </div>
    </div>
);
