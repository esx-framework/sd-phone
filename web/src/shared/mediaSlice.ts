export const SLICE_BYTES = 192 * 1024;

export function sliceCount(size: number): number {
    return Math.max(1, Math.ceil(size / SLICE_BYTES));
}

export function encodeSlice(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve('');
        reader.onload = () => {
            const value = typeof reader.result === 'string' ? reader.result : '';
            const comma = value.indexOf(',');
            resolve(comma >= 0 ? value.slice(comma + 1) : '');
        };
        reader.readAsDataURL(blob);
    });
}
