import { Play } from 'lucide-react';

import { isVideoUrl } from '@/core/photosApi';

export { isVideoUrl };

export function MediaThumb({ url, className = 'h-full w-full', badge = true }: {
    url:        string;
    className?: string;
    badge?:     boolean;
}) {
    const video = isVideoUrl(url);
    return (
        <div className={`relative overflow-hidden ${className}`}>
            {video ? (
                <video src={url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
                <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            )}
            {video && badge && (
                <span className="pointer-events-none absolute end-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/45">
                    <Play className="h-[12px] w-[12px] fill-white text-white" />
                </span>
            )}
        </div>
    );
}
