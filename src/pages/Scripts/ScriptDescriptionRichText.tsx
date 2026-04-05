import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './ScriptDescriptionRichText.scss';

export type ScriptDescriptionRichTextProps = {
    /** Initial HTML; parent should remount with `key` when this changes (e.g. after GET). */
    initialContent?: string;
    onChange: (html: string) => void;
    placeholder?: string;
};

export function ScriptDescriptionRichText({
    initialContent = '',
    onChange,
    placeholder = 'Write your ad copy…',
}: ScriptDescriptionRichTextProps) {
    const editor = useEditor(
        {
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [2, 3] },
                }),
                Placeholder.configure({ placeholder }),
            ],
            content: initialContent || '',
            editorProps: {
                attributes: {
                    class: 'tiptap script-rich-editor__prose',
                },
            },
            onUpdate: ({ editor: ed }) => {
                onChange(ed.getHTML());
            },
        },
        // Remount via parent `key` when loading a different script; avoid deps on `initialContent`
        // or the editor would reset on every keystroke.
        [],
    );

    if (!editor) {
        return <div className="script-rich-editor script-rich-editor--loading" aria-hidden />;
    }

    return (
        <div className="script-rich-editor">
            <div className="script-rich-editor__toolbar" role="toolbar" aria-label="Formatting">
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('heading', { level: 2 }) ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    title="Heading"
                >
                    H2
                </button>
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('heading', { level: 3 }) ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    title="Subheading"
                >
                    H3
                </button>
                <span className="script-rich-editor__sep" aria-hidden />
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('bold') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('italic') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('strike') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                >
                    <s>S</s>
                </button>
                <span className="script-rich-editor__sep" aria-hidden />
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('bulletList') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet list"
                >
                    • List
                </button>
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('orderedList') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered list"
                >
                    1. List
                </button>
                <span className="script-rich-editor__sep" aria-hidden />
                <button
                    type="button"
                    className={`script-rich-editor__tool${editor.isActive('blockquote') ? ' is-active' : ''}`}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                >
                    “ ”
                </button>
                <button
                    type="button"
                    className="script-rich-editor__tool"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    title="Divider"
                >
                    —
                </button>
                <span className="script-rich-editor__sep" aria-hidden />
                <button
                    type="button"
                    className="script-rich-editor__tool"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Undo"
                >
                    Undo
                </button>
                <button
                    type="button"
                    className="script-rich-editor__tool"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Redo"
                >
                    Redo
                </button>
            </div>
            <EditorContent editor={editor} className="script-rich-editor__content" />
        </div>
    );
}

/** True if editor HTML has no visible text. */
export function isRichTextEmpty(html: string): boolean {
    const stripped = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return stripped.length === 0;
}
