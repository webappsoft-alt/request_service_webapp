"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  Italic,
  Link,
  List,
  Paragraph,
  Underline,
  Undo,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

export function JobRichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  return (
    <div className="job-rich-text overflow-hidden rounded-lg border border-input bg-background">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        config={{
          licenseKey: "GPL",
          plugins: [Essentials, Paragraph, Heading, Bold, Italic, Underline, List, Link, Undo],
          toolbar: ["undo", "redo", "|", "heading", "|", "bold", "italic", "underline", "|", "bulletedList", "numberedList", "|", "link"],
          placeholder: "What happened on this job?",
        }}
        onChange={(_event, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
