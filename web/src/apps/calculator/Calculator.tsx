import { useTheme } from '@/stores/themeStore';
import { useSessionState } from '@/hooks/useSessionState';
import { t } from '@/i18n';

interface Props { onClose: () => void; }

type Op = '+' | '-' | '×' | '÷' | null;

interface State {
    display:  string;
    pending:  number | null;
    op:       Op;
    fresh:    boolean;
    history:  string;
}

const INIT: State = { display: '0', pending: null, op: null, fresh: false, history: '' };
const MAX_DIGITS = 9;

function fmt(n: number): string {
    if (!isFinite(n)) return t('calculator.error', 'Error');
    const clean = parseFloat(n.toPrecision(10));
    const s = clean.toString();
    if (s.length > MAX_DIGITS + 2) return parseFloat(n.toPrecision(6)).toExponential(2);
    return s;
}

function compute(a: number, b: number, op: Op): number {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '×': return a * b;
        case '÷': return b === 0 ? Infinity : a / b;
        default:  return b;
    }
}


type BtnColor = 'func' | 'op' | 'num';
interface BtnDef {
    label:   string;
    color:   BtnColor;
    wide?:   boolean;
    action?: Op;
    special?: 'digit' | 'dot' | 'equals' | 'clear' | 'negate' | 'pct';
    digit?:  string;
}

const GRID: BtnDef[][] = [
    [
        { label: 'C',   color: 'func', special: 'clear'  },
        { label: '+/-', color: 'func', special: 'negate' },
        { label: '%',   color: 'func', special: 'pct'    },
        { label: '÷',   color: 'op',   action:  '÷'      },
    ],
    [
        { label: '7',   color: 'num',  special: 'digit', digit: '7' },
        { label: '8',   color: 'num',  special: 'digit', digit: '8' },
        { label: '9',   color: 'num',  special: 'digit', digit: '9' },
        { label: '×',   color: 'op',   action:  '×'      },
    ],
    [
        { label: '4',   color: 'num',  special: 'digit', digit: '4' },
        { label: '5',   color: 'num',  special: 'digit', digit: '5' },
        { label: '6',   color: 'num',  special: 'digit', digit: '6' },
        { label: '-',   color: 'op',   action:  '-'      },
    ],
    [
        { label: '1',   color: 'num',  special: 'digit', digit: '1' },
        { label: '2',   color: 'num',  special: 'digit', digit: '2' },
        { label: '3',   color: 'num',  special: 'digit', digit: '3' },
        { label: '+',   color: 'op',   action:  '+'      },
    ],
    [
        { label: '0',   color: 'num',  special: 'digit', digit: '0', wide: true },
        { label: '.',   color: 'num',  special: 'dot'    },
        { label: '=',   color: 'op',   special: 'equals' },
    ],
];


export function Calculator({ onClose: _onClose }: Props) {
    const [s, setS] = useSessionState<State>('calculator:state', INIT);


    function pressDigit(d: string) {
        setS(p => {
            if (p.fresh || p.display === '0') {
                if (d === '0') return { ...p, display: '0', fresh: false, history: '' };
                return { ...p, display: d, fresh: false, history: '' };
            }
            const digits = p.display.replace(/[^0-9]/g, '').length;
            if (digits >= MAX_DIGITS) return p;
            return { ...p, display: p.display + d };
        });
    }

    function pressDot() {
        setS(p => {
            if (p.fresh) return { ...p, display: '0.', fresh: false, history: '' };
            if (p.display.includes('.')) return p;
            return { ...p, display: p.display + '.' };
        });
    }

    function pressOp(newOp: Op) {
        setS(p => {
            const val = parseFloat(p.display);
            if (p.pending !== null && !p.fresh && p.op !== null) {
                const r = compute(p.pending, val, p.op);
                return { display: fmt(r), pending: r, op: newOp, fresh: true, history: '' };
            }
            return { ...p, pending: val, op: newOp, fresh: true, history: '' };
        });
    }

    function pressEquals() {
        setS(p => {
            if (p.pending === null || p.op === null) return p;
            const b = parseFloat(p.display);
            const r = compute(p.pending, b, p.op);
            return {
                display: fmt(r),
                pending: null,
                op:      null,
                fresh:   true,
                history: `${fmt(p.pending)} ${p.op} ${p.display} =`,
            };
        });
    }

    function pressClear()   { setS(INIT); }

    function pressNegate() {
        setS(p => ({
            ...p,
            display: p.display === '0'
                ? '0'
                : p.display.startsWith('-')
                    ? p.display.slice(1)
                    : '-' + p.display,
        }));
    }

    function pressPercent() {
        setS(p => ({ ...p, display: fmt(parseFloat(p.display) / 100) }));
    }

    function handle(btn: BtnDef) {
        if (btn.action)       return pressOp(btn.action);
        if (btn.special === 'digit')  return pressDigit(btn.digit!);
        if (btn.special === 'dot')    return pressDot();
        if (btn.special === 'equals') return pressEquals();
        if (btn.special === 'clear')  return pressClear();
        if (btn.special === 'negate') return pressNegate();
        if (btn.special === 'pct')    return pressPercent();
    }


    const { theme } = useTheme('theme');
    const dk = theme === 'dark';

    const palette = {
        bg:         dk ? '#000000' : '#F2F2F7',
        display:    dk ? '#FFFFFF' : '#1C1C1E',
        expression: dk ? 'rgba(255,255,255,0.40)' : 'rgba(60,60,67,0.38)',
        func:   { bg: dk ? '#A5A5A5' : '#D4D4D2', text: dk ? '#000000' : '#3A3A3C' },
        num:    { bg: dk ? '#333335' : '#FFFFFF',  text: dk ? '#FFFFFF' : '#1C1C1E' },
        op:     { bg: '#2B6CF6', text: '#FFFFFF' },
        opActive: { bg: dk ? '#FFFFFF' : '#FFFFFF', text: '#2B6CF6' },
    };

    function btnColors(btn: BtnDef) {
        const activeOp = btn.action && s.op === btn.action && s.pending !== null;
        if (btn.color === 'func') return palette.func;
        if (btn.color === 'op')   return activeOp ? palette.opActive : palette.op;
        return palette.num;
    }

    const mainDisplay = s.pending !== null && s.op !== null
        ? s.fresh
            ? `${fmt(s.pending)} ${s.op}`
            : `${fmt(s.pending)} ${s.op} ${s.display}`
        : s.display;

    const mainLen = mainDisplay.length;
    const dispSize = mainLen > 18 ? 'text-2xl'
        : mainLen > 14 ? 'text-3xl'
        : mainLen > 10 ? 'text-4xl'
        : mainLen > 7  ? 'text-5xl'
        : mainLen > 5  ? 'text-[64px]'
        : 'text-[80px]';


    return (
        <div dir="ltr" className="absolute inset-0 flex flex-col select-none" style={{ backgroundColor: palette.bg }}>
            <div className="flex flex-1 flex-col items-end justify-end px-5 pb-3 gap-0.5">
                <span
                    className="text-[22px] font-light leading-none"
                    style={{
                        color:      palette.expression,
                        minHeight:  '1.4em',
                        opacity:    s.history ? 1 : 0,
                        transition: 'opacity 0.15s',
                    }}
                >
                    {s.history || ' '}
                </span>
                <span
                    className={`${dispSize} font-thin leading-none tracking-tight`}
                    style={{ color: palette.display }}
                >
                    {mainDisplay}
                </span>
            </div>

            <div className="flex flex-col gap-3 px-3 pb-10">
                {GRID.map((row, ri) => (
                    <div key={ri} className="flex gap-3">
                        {row.map((btn, ci) => {
                            const c = btnColors(btn);
                            return (
                                <button
                                    key={ci}
                                    type="button"
                                    onClick={() => handle(btn)}
                                    className={`flex shrink-0 items-center active:opacity-70 transition-colors duration-100 ${
                                        btn.wide
                                            ? 'flex-[2_2_0%] justify-start ps-7'
                                            : 'flex-1 justify-center'
                                    }`}
                                    style={{
                                        height:          80,
                                        borderRadius:    40,
                                        backgroundColor: c.bg,
                                        color:           c.text,
                                        boxShadow: !dk && btn.color === 'num'
                                            ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 8px rgba(0,0,0,0.06)'
                                            : undefined,
                                    }}
                                >
                                    <span className="text-[34px] font-normal leading-none">
                                        {btn.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
