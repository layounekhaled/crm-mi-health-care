'use client'

import dynamic from 'next/dynamic'
import { ComponentType, useCallback, useRef, useMemo } from 'react'

// ─── Types pour react-quill ──────────────────────────────────────

interface ReactQuillProps {
  theme?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  modules?: Record<string, unknown>
  formats?: string[]
  style?: React.CSSProperties
  readOnly?: boolean
}

// ─── Dynamic import (no SSR) ─────────────────────────────────────

const ReactQuill: ComponentType<ReactQuillProps> = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new')
    return RQ
  },
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full rounded-md border border-slate-200 bg-slate-50 animate-pulse flex items-center justify-center">
        <span className="text-sm text-slate-400">Chargement de l&apos;éditeur...</span>
      </div>
    ),
  }
)

// ─── Import Quill styles ─────────────────────────────────────────

if (typeof window !== 'undefined') {
  import('react-quill-new/dist/quill.snow.css')
}

// ─── Custom toolbar configuration ────────────────────────────────

const EMAIL_TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'blockquote'],
  ['clean'],
]

const EMAIL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet', 'align',
  'link', 'blockquote',
]

// ─── Component Props ─────────────────────────────────────────────

interface QuillEmailEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  readOnly?: boolean
}

// ─── Component ───────────────────────────────────────────────────

export default function QuillEmailEditor({
  value,
  onChange,
  placeholder = 'Écrivez votre message...',
  style,
  readOnly = false,
}: QuillEmailEditorProps) {
  const quillRef = useRef<unknown>(null)

  const modules = useMemo(() => ({
    toolbar: EMAIL_TOOLBAR_OPTIONS,
    clipboard: {
      // Custom clipboard to clean pasted HTML
      matchVisual: false,
    },
    history: {
      delay: 1000,
      maxStack: 50,
      userOnly: false,
    },
  }), [])

  const handleChange = useCallback(
    (content: string) => {
      // Don't fire onChange if content is just empty paragraph
      if (content === '<p><br></p>') {
        onChange('')
      } else {
        onChange(content)
      }
    },
    [onChange]
  )

  return (
    <div className="quill-email-editor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={EMAIL_FORMATS}
        readOnly={readOnly}
        style={style}
      />
    </div>
  )
}

// ─── Signature Editor (simpler toolbar) ──────────────────────────

const SIGNATURE_TOOLBAR_OPTIONS = [
  ['bold', 'italic', 'underline'],
  [{ color: [] }],
  ['link'],
  ['clean'],
]

const SIGNATURE_FORMATS = [
  'bold', 'italic', 'underline', 'color', 'link',
]

interface SignatureEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SignatureEditor({
  value,
  onChange,
  placeholder = 'Votre signature email...',
}: SignatureEditorProps) {
  const modules = useMemo(() => ({
    toolbar: SIGNATURE_TOOLBAR_OPTIONS,
    clipboard: { matchVisual: false },
  }), [])

  const handleChange = useCallback(
    (content: string) => {
      if (content === '<p><br></p>') {
        onChange('')
      } else {
        onChange(content)
      }
    },
    [onChange]
  )

  return (
    <div className="quill-signature-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={SIGNATURE_FORMATS}
        style={{ minHeight: 80 }}
      />
    </div>
  )
}
