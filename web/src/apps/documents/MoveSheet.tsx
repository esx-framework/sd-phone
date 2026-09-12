import type { ReactNode } from 'react';
import { Folder, HardDrive } from 'lucide-react';

import { Sheet } from '@/ui/Sheet';
import { ListRow } from '@/ui/ListGroup';
import { t } from '@/i18n';
import { orderedFolders, type DocFolder } from './data';

interface Props {
    folders:         DocFolder[];
    currentFolderId: string | null;
    onSelect:        (folderId: string | null) => void;
    onClose:         () => void;
}

export function MoveSheet({ folders, currentFolderId, onSelect, onClose }: Props) {
    const ordered = orderedFolders(folders);

    return (
        <Sheet onClose={onClose} fit="content" title={t('documents.moveTo', 'Move to')} className="bg-surface">
            {({ close }) => {
                const choose = (id: string | null) => { onSelect(id); close(); };
                const Row = ({ id, name, depth, icon }: { id: string | null; name: string; depth: number; icon: ReactNode }) => (
                    <ListRow
                        label={name}
                        selected={(currentFolderId ?? null) === id}
                        left={
                            <span className="flex items-center text-ios-blue" style={{ paddingInlineStart: depth * 20 }}>
                                {icon}
                            </span>
                        }
                        onPress={() => choose(id)}
                    />
                );

                return (
                    <div className="max-h-[52vh] overflow-y-auto no-scrollbar pb-4">
                        <Row id={null} name={t('documents.filesRoot', 'Files')} depth={0} icon={<HardDrive className="h-[22px] w-[22px]" strokeWidth={2} />} />
                        {ordered.map(({ folder, depth }) => (
                            <Row key={folder.id} id={folder.id} name={folder.name} depth={depth + 1} icon={<Folder className="h-[22px] w-[22px]" strokeWidth={2} fill="currentColor" />} />
                        ))}
                    </div>
                );
            }}
        </Sheet>
    );
}
