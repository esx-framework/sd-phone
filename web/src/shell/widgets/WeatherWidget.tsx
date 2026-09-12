import { useMemo } from 'react';

import type { WidgetAlign, WidgetSize } from '@/apps/appstore/appsApi';
import { PROFILES, backgroundFor, buildForecast, formatHour, getWeatherLabel, isDaytime } from '@/apps/weather/data';
import type { DayForecast, WeatherCode } from '@/apps/weather/data';
import { WeatherIcon } from '@/apps/weather/WeatherIcon';
import { t } from '@/i18n';
import { useWidgetData } from '@/stores/widgetDataStore';
import { WidgetTile, alignClasses } from './WidgetTile';

const CODES = new Set(['EXTRASUNNY', 'CLEAR', 'CLOUDS', 'OVERCAST', 'RAIN', 'THUNDER', 'CLEARING', 'SMOG', 'FOGGY', 'SNOW', 'BLIZZARD', 'SNOWLIGHT', 'XMAS', 'HALLOWEEN', 'NEUTRAL']);
const asCode = (v?: string): WeatherCode | null => (v && CODES.has(v) ? (v as WeatherCode) : null);

const RULE = 'rgba(255,255,255,0.18)';

const HOURS = { sm: 0, md: 5, lg: 6 };
const DAYS  = 5;

function TempBar({ day, min, max }: { day: DayForecast; min: number; max: number }) {
    const span  = Math.max(1, max - min);
    const left  = ((day.low - min) / span) * 100;
    const width = Math.max(8, ((day.high - day.low) / span) * 100);
    return (
        <div className="relative h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.24)' }}>
            <div
                className="absolute inset-y-0 rounded-full"
                style={{ left: `${left}%`, width: `${width}%`, background: 'linear-gradient(90deg, #6ec6ff, #ffd60a)' }}
            />
        </div>
    );
}

export function WeatherWidget({ size, width, height, align = 'left' }: {
    size: WidgetSize; width: number; height: number; align?: WidgetAlign;
}) {
    const al = alignClasses(align);
    const payload = useWidgetData(s => s.weather);

    const city = useMemo(() => {
        const cur = asCode(payload?.current);
        const live = cur ? { current: cur, next: asCode(payload?.next) ?? cur, time: payload?.time } : undefined;
        return buildForecast(PROFILES.find(p => p.id === 'los_santos')!, live);
    }, [payload]);

    const day    = isDaytime(city.nowTimeGame?.hour);
    const [top, bottom] = backgroundFor(city.nowCode, day);
    const label  = getWeatherLabel()[city.nowCode];
    const today  = city.daily[0];
    const strip  = city.hourly.slice(1, 1 + HOURS[size]);
    const days   = city.daily.slice(0, DAYS);

    const min = Math.min(...days.map(d => d.low));
    const max = Math.max(...days.map(d => d.high));

    const tile = (children: React.ReactNode) => (
        <WidgetTile
            width={width}
            height={height}
            radius={size === 'sm' ? 22 : 26}
            tint={`linear-gradient(165deg, ${top}, ${bottom})`}
        >
            {children}
        </WidgetTile>
    );

    const Hourly = ({ px }: { px: number }) => (
        <div className="flex shrink-0 items-end justify-between gap-1">
            {strip.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums opacity-75">{formatHour(h.offset, city.nowTimeGame?.hour)}</span>
                    <WeatherIcon code={h.code} className="opacity-95" style={{ width: px, height: px }} />
                    <span className="text-[12px] font-semibold tabular-nums">{h.tempF}&deg;</span>
                </div>
            ))}
        </div>
    );

    if (size === 'sm') {
        return tile(
            <div className="flex h-full w-full flex-col justify-between p-3.5 text-white">
                <div className={`flex gap-2 ${align === 'center' ? 'items-center justify-center' : align === 'right' ? 'flex-row-reverse items-start' : 'items-start justify-between'}`}>
                    <div className={`flex min-w-0 flex-col ${al}`}>
                        <div className="truncate text-[13px] font-semibold leading-tight opacity-95">
                            {t('weather.losSantos', 'Los Santos')}
                        </div>
                        <div className="mt-0.5 text-[34px] font-light leading-none tabular-nums tracking-tight">
                            {city.nowTempF}&deg;
                        </div>
                    </div>
                    <WeatherIcon code={city.nowCode} className="h-[34px] w-[34px] shrink-0 opacity-95" />
                </div>
                <div className={`flex flex-col ${al}`}>
                    <div className="truncate text-[12px] font-medium leading-tight opacity-90">{label}</div>
                    <div className="text-[11px] tabular-nums opacity-70">{`H:${today.high}°  L:${today.low}°`}</div>
                </div>
            </div>,
        );
    }

    const big = size === 'lg';
    return tile(
        <div className="flex h-full w-full flex-col p-4 text-white">
            <div className={`flex shrink-0 gap-3 ${align === 'center' ? 'items-center justify-center' : align === 'right' ? 'flex-row-reverse items-start' : 'items-start justify-between'}`}>
                <div className={`flex min-w-0 flex-col ${al}`}>
                    <div className="truncate font-semibold leading-tight opacity-95" style={{ fontSize: big ? 17 : 14 }}>
                        {t('weather.losSantos', 'Los Santos')}
                    </div>
                    <div className="mt-0.5 font-light leading-none tabular-nums tracking-tight" style={{ fontSize: big ? 56 : 42 }}>
                        {city.nowTempF}&deg;
                    </div>
                    <div className="mt-1 truncate font-medium leading-tight opacity-90" style={{ fontSize: big ? 15 : 13 }}>
                        {label}
                    </div>
                    <div className="tabular-nums opacity-70" style={{ fontSize: big ? 13 : 11 }}>
                        {`H:${today.high}°  L:${today.low}°`}
                    </div>
                </div>
                <WeatherIcon
                    code={city.nowCode}
                    className="shrink-0 opacity-95"
                    style={{ width: big ? 62 : 40, height: big ? 62 : 40 }}
                />
            </div>

            <div className="my-2.5 shrink-0" style={{ borderTop: `1px solid ${RULE}` }} />
            <Hourly px={big ? 20 : 17} />

            {big && (
                <>
                    <div className="my-2.5 shrink-0" style={{ borderTop: `1px solid ${RULE}` }} />
                    <div className="flex min-h-0 flex-1 flex-col justify-between">
                        {days.map((d, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                                <span className="w-[42px] shrink-0 truncate text-[13px] font-medium opacity-90">{d.label}</span>
                                <WeatherIcon code={d.code} className="h-[18px] w-[18px] shrink-0 opacity-95" />
                                <span className="w-[30px] shrink-0 text-end text-[13px] tabular-nums opacity-70">{d.low}&deg;</span>
                                <TempBar day={d} min={min} max={max} />
                                <span className="w-[30px] shrink-0 text-end text-[13px] font-medium tabular-nums">{d.high}&deg;</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>,
    );
}
