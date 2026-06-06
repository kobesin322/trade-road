"use client";

import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-black/30 p-2">
        {[
          { icon: Bold, command: "bold", label: "Bold" },
          { icon: Italic, command: "italic", label: "Italic" },
          { icon: Underline, command: "underline", label: "Underline" },
          { icon: List, command: "insertUnorderedList", label: "Bullets" },
          { icon: ListOrdered, command: "insertOrderedList", label: "Numbered list" },
        ].map(({ icon: Icon, command, label }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            onMouseDown={(event) => {
              event.preventDefault();
              exec(command);
              editorRef.current?.focus();
              onChange(editorRef.current?.innerHTML ?? "");
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:bg-white/10"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Write your journal notes..."}
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        className="min-h-40 rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none focus:border-cyan-300/60 empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
