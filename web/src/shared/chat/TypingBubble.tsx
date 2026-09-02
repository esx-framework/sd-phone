const DOTS = [0, 1, 2];

export function TypingBubble({ receivedBg, isDark }: { receivedBg: string; isDark: boolean }) {
    return (
        <div
            className="imsg-typing flex items-center gap-[5px] rounded-2xl rounded-bl-md px-[15px] py-[11px]"
            style={{ background: receivedBg }}
        >
            {DOTS.map(i => (
                <span
                    key={i}
                    className="imsg-typing-dot h-[8px] w-[8px] rounded-full"
                    style={{
                        background: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)',
                        animationDelay: `${i * 0.18}s`,
                    }}
                />
            ))}
        </div>
    );
}
