export type ToolDef = {
  slug: string
  name: string
  category: string
}

export const TOOLS: ToolDef[] = [
  { slug: 'merge-pdf', name: 'Merge PDF', category: 'Organize PDF' },
  { slug: 'split-pdf', name: 'Split PDF', category: 'Organize PDF' },
  { slug: 'compress-pdf', name: 'Compress PDF', category: 'Optimize PDF' },
  { slug: 'organize-pdf', name: 'Organize PDF', category: 'Organize PDF' },
  { slug: 'rotate-pdf', name: 'Rotate PDF', category: 'Organize PDF' },
  { slug: 'extract-pages', name: 'Extract Pages', category: 'Organize PDF' },
  { slug: 'remove-pages', name: 'Remove Pages', category: 'Organize PDF' },
  { slug: 'add-page-numbers', name: 'Add Page Numbers', category: 'Edit PDF' },
  { slug: 'add-watermark', name: 'Add Watermark', category: 'Edit PDF' },
  { slug: 'crop-pdf', name: 'Crop PDF', category: 'Edit PDF' },
  { slug: 'edit-pdf', name: 'Edit PDF', category: 'Edit PDF' },
  { slug: 'edit-metadata', name: 'Edit PDF Metadata', category: 'Edit PDF' },
  { slug: 'unlock-pdf', name: 'Unlock PDF', category: 'Security PDF' },
  { slug: 'protect-pdf', name: 'Protect PDF', category: 'Security PDF' },
  { slug: 'jpg-to-pdf', name: 'JPG to PDF', category: 'Convert to PDF' },
  { slug: 'word-to-pdf', name: 'Word to PDF', category: 'Convert to PDF' },
  { slug: 'powerpoint-to-pdf', name: 'PowerPoint to PDF', category: 'Convert to PDF' },
  { slug: 'excel-to-pdf', name: 'Excel to PDF', category: 'Convert to PDF' },
  { slug: 'html-to-pdf', name: 'HTML to PDF', category: 'Convert to PDF' },
  { slug: 'pdf-to-jpg', name: 'PDF to JPG', category: 'Convert from PDF' },
  { slug: 'pdf-to-word', name: 'PDF to Word', category: 'Convert from PDF' },
  { slug: 'pdf-to-powerpoint', name: 'PDF to PowerPoint', category: 'Convert from PDF' },
  { slug: 'pdf-to-excel', name: 'PDF to Excel', category: 'Convert from PDF' },
  { slug: 'pdf-to-pdfa', name: 'PDF to PDF/A', category: 'Convert from PDF' },
  { slug: 'pdf-to-text', name: 'PDF to Text', category: 'Convert from PDF' },
  { slug: 'redact-pdf', name: 'Redact PDF', category: 'Security PDF' },
  { slug: 'translate-pdf', name: 'Translate PDF', category: 'Advanced PDF' },
  { slug: 'repair-pdf', name: 'Repair PDF', category: 'Advanced PDF' },
  { slug: 'ocr-pdf', name: 'OCR PDF', category: 'Advanced PDF' },
  { slug: 'scan-to-pdf', name: 'Scan to PDF', category: 'Advanced PDF' },
  { slug: 'compare-pdf', name: 'Compare PDF', category: 'Advanced PDF' },
  { slug: 'sign-pdf', name: 'Sign PDF', category: 'Edit PDF' }
]
