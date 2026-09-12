import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Code, Heading1, Heading2, Heading3, Italic, List, Strikethrough, Underline } from 'lucide-react';

import { t } from '@/i18n';
import { mdtFieldBase, mdtSectionHeader } from '../mdtTheme';
import { domToMarkdown, mdToFragment } from './mdtRich';

interface Tool {
    id:     string;
    icon:   typeof Bold;
    cmd?:   string;
    block?: 'h1' | 'h2' | 'h3';
}

const TOOLS: Tool[] = [
    { id: 'h1',                  icon: Heading1,      block: 'h1' },
    { id: 'h2',                  icon: Heading2,      block: 'h2' },
    { id: 'h3',                  icon: Heading3,      block: 'h3' },
    { id: 'bold',                icon: Bold,          cmd: 'bold' },
    { id: 'italic',              icon: Italic,        cmd: 'italic' },
    { id: 'underline',           icon: Underline,     cmd: 'underline' },
    { id: 'strikeThrough',       icon: Strikethrough, cmd: 'strikeThrough' },
    { id: 'code',                icon: Code },
    { id: 'insertUnorderedList', icon: List,          cmd: 'insertUnorderedList' },
];

function toolLabels(): Record<string, string> {
    return {
        h1:                  t('mdt.rtH1', 'Heading 1'),
        h2:                  t('mdt.rtH2', 'Heading 2'),
        h3:                  t('mdt.rtH3', 'Heading 3'),
        bold:                t('mdt.rtBold', 'Bold'),
        italic:              t('mdt.rtItalic', 'Italic'),
        underline:           t('mdt.rtUnderline', 'Underline'),
        strikeThrough:       t('mdt.rtStrike', 'Strikethrough'),
        code:                t('mdt.rtCode', 'Code'),
        insertUnorderedList: t('mdt.rtBullet', 'Bullet list'),
    };
}

function currentBlock(): string {
    try {
        return (document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch {
        return '';
    }
}

function headingAncestor(root: HTMLElement): HTMLElement | null {
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== root) {
        if (node.nodeType === Node.ELEMENT_NODE && /^H[1-3]$/.test((node as HTMLElement).tagName)) {
            return node as HTMLElement;
        }
        node = node.parentNode;
    }
    return null;
}

function unwrapHeading(root: HTMLElement) {
    const head = headingAncestor(root);
    if (!head?.parentNode) return;

    const div = document.createElement('div');
    while (head.firstChild) div.appendChild(head.firstChild);
    if (!div.firstChild) div.appendChild(document.createElement('br'));
    head.parentNode.replaceChild(div, head);

    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(div);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function codeAncestor(root: HTMLElement): HTMLElement | null {
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== root) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'CODE') return node as HTMLElement;
        node = node.parentNode;
    }
    return null;
}

function toggleCode(root: HTMLElement) {
    const open = codeAncestor(root);
    if (open?.parentNode) {
        const parent = open.parentNode;
        while (open.firstChild) parent.insertBefore(open.firstChild, open);
        parent.removeChild(open);
        return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const el = document.createElement('code');
    el.appendChild(range.extractContents());
    range.insertNode(el);

    const after = document.createRange();
    after.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(after);
}

export function MdtRichField({ label, value, onChange, rows = 8, maxLength, placeholder }: {
    label?:       string;
    value:        string;
    onChange:     (value: string) => void;
    rows?:        number;
    maxLength?:   number;
    placeholder?: string;
}) {
    const ref   = useRef<HTMLDivElement>(null);
    const bar   = useRef<HTMLSpanElement>(null);
    const sent  = useRef<string | null>(null);
    const saved = useRef<Range | null>(null);
    const [active, setActive] = useState<Record<string, boolean>>({});
    const [empty,  setEmpty]  = useState(true);
    const labels = toolLabels();

    useEffect(() => {
        const el = ref.current;
        if (!el || value === sent.current) return;
        sent.current = value;
        el.replaceChildren(mdToFragment(value));
        setEmpty(value.trim().length === 0);
    }, [value]);

    useEffect(() => {
        const strip = bar.current;
        if (!strip) return;
        function onDown(e: MouseEvent) {
            const el = ref.current;
            const sel = window.getSelection();
            if (el && sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (el.contains(range.commonAncestorContainer)) saved.current = range.cloneRange();
            }
            e.preventDefault();
        }
        strip.addEventListener('mousedown', onDown, true);
        return () => strip.removeEventListener('mousedown', onDown, true);
    }, []);

    const syncMarks = useCallback(() => {
        const el = ref.current;
        const sel = window.getSelection();
        if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
        const block = currentBlock();
        const head = headingAncestor(el)?.tagName.toLowerCase() ?? '';
        const next: Record<string, boolean> = { code: !!codeAncestor(el) };
        for (const tool of TOOLS) {
            if (tool.cmd) next[tool.id] = document.queryCommandState(tool.cmd);
            else if (tool.block) next[tool.id] = block === tool.block || head === tool.block;
        }
        setActive(next);
    }, []);

    useEffect(() => {
        document.addEventListener('selectionchange', syncMarks);
        return () => document.removeEventListener('selectionchange', syncMarks);
    }, [syncMarks]);

    function emit() {
        const el = ref.current;
        if (!el) return;
        const md = domToMarkdown(el);
        setEmpty(el.innerText.trim().length === 0);
        if (md === sent.current) return;
        sent.current = md;
        onChange(md);
    }

    function restore() {
        const el = ref.current;
        if (!el) return;
        el.focus();

        const sel = window.getSelection();
        const want = saved.current;
        if (!sel || !want) return;

        const live = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
        if (live && !live.collapsed && el.contains(live.commonAncestorContainer)) return;

        sel.removeAllRanges();
        sel.addRange(want);
    }

    function run(tool: Tool) {
        const el = ref.current;
        if (!el) return;
        restore();
        if (tool.cmd) document.execCommand(tool.cmd);
        else if (tool.block) {
            const on = currentBlock() === tool.block || headingAncestor(el)?.tagName.toLowerCase() === tool.block;
            document.execCommand('formatBlock', false, on ? '<div>' : `<${tool.block}>`);
            if (on) unwrapHeading(el);
        }
        else toggleCode(el);
        syncMarks();
        emit();
    }

    return (
        <div className="block min-w-0">
            <div className="mb-1 flex items-center gap-1">
                {label && <span className={mdtSectionHeader}>{label}</span>}
                <span ref={bar} className="ms-auto flex items-center gap-0.5">
                    {TOOLS.map(tool => {
                        const Icon = tool.icon;
                        const on = !!active[tool.id];
                        const name = labels[tool.id];
                        return (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => run(tool)}
                                aria-label={name}
                                aria-pressed={on}
                                title={name}
                                className={`flex h-[26px] w-[26px] items-center justify-center rounded-[7px] transition-colors ${on
                                    ? 'bg-ios-blue text-white'
                                    : 'text-ios-gray hover:bg-black/[0.06] hover:text-black dark:hover:bg-white/[0.08] dark:hover:text-white'}`}
                            >
                                <Icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
                            </button>
                        );
                    })}
                </span>
            </div>

            <div className="relative">
                <div
                    ref={ref}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label={label}
                    onFocus={() => { document.execCommand('styleWithCSS', false, 'false'); syncMarks(); }}
                    onInput={emit}
                    onKeyUp={syncMarks}
                    onMouseUp={syncMarks}
                    onBeforeInput={e => {
                        const native = e.nativeEvent as InputEvent;
                        if (!maxLength || native.inputType?.startsWith('delete')) return;
                        if ((sent.current ?? '').length >= maxLength) e.preventDefault();
                    }}
                    onPaste={e => {
                        e.preventDefault();
                        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                    }}
                    className={`w-full overflow-y-auto px-3 py-2 text-[15px] leading-snug ${mdtFieldBase} [&_code]:rounded-[4px] [&_code]:bg-black/[0.07] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.92em] dark:[&_code]:bg-white/[0.14] [&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-5 [&_h1]:mb-1 [&_h1]:mt-3 [&_h1]:text-[1.3em] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-[1.15em] [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:mb-0.5 [&_h3]:mt-2.5 [&_h3]:text-[1.02em] [&_h3]:font-semibold [&_h3]:leading-tight [&>*:first-child]:mt-0`}
                    style={{ minHeight: rows * 22, maxHeight: rows * 34 }}
                />
                {empty && placeholder && (
                    <span className="pointer-events-none absolute start-3 top-2 text-[15px] leading-snug text-black/35 dark:text-white/35">
                        {placeholder}
                    </span>
                )}
            </div>
        </div>
    );
}
