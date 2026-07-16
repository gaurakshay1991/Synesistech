import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const TEXT_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml'
]);

function extension(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function cleanText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export async function extractDocumentText(file, pastedText = '') {
  const manual = cleanText(pastedText);
  if (!file) {
    if (!manual) throw new Error('Upload a document or paste document text.');
    return {
      text: manual,
      fileName: 'Pasted document',
      mimeType: 'text/plain',
      sizeBytes: Buffer.byteLength(manual),
      parser: 'pasted-text'
    };
  }

  const ext = extension(file.originalname);
  const mime = file.mimetype || 'application/octet-stream';
  let extracted = '';
  let parser = '';

  if (mime === 'application/pdf' || ext === 'pdf') {
    const result = await pdfParse(file.buffer);
    extracted = result.text;
    parser = 'pdf-parse';
  } else if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    extracted = result.value;
    parser = 'mammoth-docx';
  } else if (TEXT_TYPES.has(mime) || ['txt', 'csv', 'json', 'md', 'xml'].includes(ext)) {
    extracted = file.buffer.toString('utf8');
    parser = `text-${ext || 'plain'}`;
  } else {
    if (!manual) {
      throw new Error(`Unsupported file type: ${mime || ext || 'unknown'}. Use PDF, DOCX, TXT, CSV, JSON, MD or paste the text.`);
    }
    extracted = manual;
    parser = 'pasted-text-with-unsupported-file-metadata';
  }

  const combined = cleanText([extracted, manual && manual !== extracted ? `\n\nUSER-PROVIDED CONTEXT\n${manual}` : ''].join(''));
  if (combined.length < 20) throw new Error('The uploaded document did not contain enough readable text.');

  return {
    text: combined.slice(0, 180000),
    fileName: file.originalname,
    mimeType: mime,
    sizeBytes: file.size,
    parser,
    truncated: combined.length > 180000
  };
}
