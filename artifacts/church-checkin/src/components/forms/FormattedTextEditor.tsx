import { useEffect, useRef } from "react";
import { Bold, Italic, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TextSize = "small" | "normal" | "large";

type FormattedTextEditorProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
};

const SIZE_CLASS: Record<TextSize, string> = {
  small: "text-sm",
  normal: "text-base",
  large: "text-lg",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function formattedTextMarkupToHtml(value: string) {
  return escapeHtml(value)
    .replace(/\[(small|normal|large)\]([\s\S]*?)\[\/\1\]/g, (_match, size: TextSize, content: string) => (
      `<span data-text-size="${size}" class="${SIZE_CLASS[size]}">${content}</span>`
    ))
    .replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([\s\S]*?)_/g, "<em>$1</em>")
    .replaceAll("\n", "<br>");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const tagName = node.tagName.toLowerCase();
  if (tagName === "br") return "\n";

  const content = Array.from(node.childNodes).map(serializeNode).join("");

  if (tagName === "strong" || tagName === "b") return `**${content}**`;
  if (tagName === "em" || tagName === "i") return `_${content}_`;

  const textSize = node.dataset.textSize;
  if (textSize === "small" || textSize === "normal" || textSize === "large") {
    return `[${textSize}]${content}[/${textSize}]`;
  }

  if (tagName === "div" || tagName === "p") return `${content}\n`;
  return content;
}

function normalizeSerialized(value: string) {
  return value.replace(/\n{3,}/g, "\n\n").replace(/\n$/, "");
}

function syncValueFromEditor(editor: HTMLElement, onChange: (value: string) => void) {
  onChange(normalizeSerialized(Array.from(editor.childNodes).map(serializeNode).join("")));
}

function placeCaretInside(node: Node) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function FormattedTextEditor({
  id,
  label,
  value,
  onChange,
  placeholder,
  minHeightClassName = "min-h-[136px]",
}: FormattedTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSyncedValue = useRef<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || lastSyncedValue.current === value) return;
    editor.innerHTML = value ? formattedTextMarkupToHtml(value) : "";
    lastSyncedValue.current = value;
  }, [value]);

  const applyInlineCommand = (command: "bold" | "italic") => {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) syncValueFromEditor(editorRef.current, onChange);
  };

  const applySize = (size: TextSize) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;
    editor.focus();

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const selectedText = range?.toString() || "text";
    const span = document.createElement("span");
    span.dataset.textSize = size;
    span.className = SIZE_CLASS[size];
    span.textContent = selectedText;

    if (range && !range.collapsed) {
      range.deleteContents();
      range.insertNode(span);
    } else {
      editor.appendChild(span);
    }

    placeCaretInside(span);
    syncValueFromEditor(editor, onChange);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/20 p-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyInlineCommand("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyInlineCommand("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 pl-1">
          <Type className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={(value) => applySize(value as TextSize)}>
            <SelectTrigger className="h-8 w-[104px] bg-background text-xs">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={`${minHeightClassName} rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 shadow-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-1 focus-visible:ring-ring`}
        onInput={(event) => {
          const next = normalizeSerialized(Array.from(event.currentTarget.childNodes).map(serializeNode).join(""));
          lastSyncedValue.current = next;
          onChange(next);
        }}
      />
    </div>
  );
}
