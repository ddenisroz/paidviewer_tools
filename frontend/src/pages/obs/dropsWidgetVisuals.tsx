import { ChevronDown, Sparkles, Volume2 } from 'lucide-react';

import { getLootboxImages, qualityLabel, qualityTone } from './dropsWidgetAssets';

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
}> = ({ previewByQuality, status, onTriggerPreview }) => (
    <div className="absolute left-5 top-5 z-20 w-[360px] rounded-2xl border border-white/10 bg-[#0f1421e6] p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
            <Sparkles className="h-4 w-4" />
            Preview
        </div>
        <div className="mt-2 text-lg font-semibold">Тест открытия сундука</div>
        <p className="mt-1 text-sm text-white/60">
            В OBS виджет будет пустым до события. Здесь можно вручную запустить тест по типу сундука.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {previewByQuality.map(({ quality, count }) => (
                <button
                    key={quality}
                    type="button"
                    onClick={() => onTriggerPreview(quality)}
                    className={`rounded-xl border px-3 py-3 text-left transition-transform hover:-translate-y-0.5 ${qualityTone(quality)}`}
                >
                    <div className="text-sm font-semibold">{qualityLabel(quality)}</div>
                    <div className="mt-1 text-xs opacity-80">{count > 0 ? `${count} наград в пуле` : 'Тестовый сценарий'}</div>
                </button>
            ))}
        </div>
        <div className="mt-4 text-xs text-white/45">{status}</div>
    </div>
);

export const DropsWidgetOpeningStage: React.FC<{ quality: string; viewerName?: string }> = ({ quality, viewerName }) => {
    const lootbox = getLootboxImages(quality);
    return (
        <div className="flex h-[236px] items-center justify-center">
            <div className="relative flex items-center gap-7">
                <img src={lootbox.closed} alt="" className="h-40 w-40 object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.45)]" />
                <div className={`rounded-3xl border px-8 py-7 text-center ${qualityTone(quality)}`}>
                    <p className="text-xs uppercase tracking-[0.3em] opacity-75">Сундук активирован</p>
                    <h2 className="mt-3 text-2xl font-semibold">{viewerName || 'Зритель'}</h2>
                    <p className="mt-2 text-sm opacity-80">{qualityLabel(quality)} сундук открывается</p>
                </div>
            </div>
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
    return (
        <div className="relative h-[236px] overflow-hidden">
            <img
                src={phase === 'result' ? lootbox.opened : lootbox.closed}
                alt=""
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-52 w-52 -translate-x-1/2 -translate-y-1/2 object-contain opacity-25 blur-[1px] drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]"
            />
            <div className="absolute left-0 top-1/2 z-10 flex -translate-y-1/2 items-stretch gap-4" style={{ transform: translateX, willChange: 'transform' }}>
                {reelItems.map((item, index) => {
                    const isWinner = phase === 'result' && index === winnerSlotIndex;
                    return (
                        <div
                            key={item.id}
                            className={`flex h-[220px] w-[188px] shrink-0 flex-col rounded-[24px] border bg-[#07111fee] transition-all duration-300 ${
                                isWinner ? 'scale-[1.04] border-amber-300 shadow-[0_0_70px_rgba(251,191,36,0.28)]' : 'border-white/8 opacity-85'
                            }`}
                        >
                            <div className="flex h-[116px] items-center justify-center rounded-t-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.09),_transparent_50%),linear-gradient(180deg,_rgba(14,23,39,0.95),_rgba(7,12,24,0.98))]">
                                <span className="text-6xl font-black text-white/88">?</span>
                            </div>
                            <div className="flex flex-1 flex-col px-4 py-3">
                                <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[11px] font-medium ${qualityTone(item.quality)}`}>
                                    {qualityLabel(item.quality)}
                                </span>
                                <p className="mt-4 text-lg font-semibold text-white">{isWinner ? item.reward?.name || 'Награда' : '???'}</p>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">
                                    {isWinner ? item.reward?.description || 'Содержимое сундука раскрыто.' : 'Содержимое скрыто до остановки барабана.'}
                                </p>
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
        <div className="mx-auto mt-5 max-w-[780px] rounded-[24px] border border-white/10 bg-[#0c121ddd] px-6 py-5 text-center text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <img src={lootbox.opened} alt="" className="mx-auto mb-3 h-24 w-24 object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.4)]" />
            <div className="text-xs uppercase tracking-[0.3em] text-white/45">Содержимое сундука</div>
            <div className="mt-3 text-3xl font-semibold">{reward.reward_name || 'Награда'}</div>
            {reward.description ? <p className="mt-3 text-sm leading-6 text-white/65">{reward.description}</p> : null}
            {reward.sound_file ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                    <Volume2 className="h-3.5 w-3.5" />
                    Звук награды проигран
                </div>
            ) : null}
        </div>
    );
};

export const DropsWidgetPreviewBadge: React.FC = () => (
    <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-[#0c121dd8] px-3 py-2 text-xs text-white/55 backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
            Тестовый режим активен
        </div>
    </div>
);
