import { PDFDocument, StandardFonts } from 'pdf-lib';
import { DlpScannerService } from './dlp-scanner.service';

async function buildPdf(lines: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([400, 300]);
  lines.forEach((line, index) => {
    page.drawText(line, { x: 20, y: 260 - index * 20, size: 12, font });
  });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

describe('DlpScannerService', () => {
  let service: DlpScannerService;

  beforeEach(() => {
    service = new DlpScannerService();
  });

  it('detects sensitive contact and keyword patterns in text files', async () => {
    const result = await service.scan(
      Buffer.from('Internal only file. Contact ceo@example.com or 0901234567.'),
      'text/plain',
    );

    expect(result.status).toBe('DETECTED');
    if (result.status !== 'DETECTED') {
      throw new Error('Expected DLP detection');
    }
    expect(result.suggestedClassification).toBe('CONFIDENTIAL');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'KEYWORD', pattern: 'internal only' }),
        expect.objectContaining({ type: 'EMAIL' }),
        expect.objectContaining({ type: 'PHONE' }),
      ]),
    );
  });

  it('returns CLEAR when no DLP pattern is present', async () => {
    expect(await service.scan(Buffer.from('normal project document'), 'text/plain')).toEqual({
      status: 'CLEAR',
      findings: [],
    });
  });

  it('extracts real text from a PDF and detects a genuine phone number', async () => {
    const pdf = await buildPdf(['Call me at 0901234567 about the deal.']);

    const result = await service.scan(pdf, 'application/pdf');

    expect(result.status).toBe('DETECTED');
    if (result.status !== 'DETECTED') {
      throw new Error('Expected DLP detection');
    }
    const phone = result.findings.find((finding) => finding.type === 'PHONE');
    expect(phone).toBeDefined();
    expect(phone?.count).toBe(1);
  });

  it('does not raise findings for a clean PDF (no binary false positives)', async () => {
    const pdf = await buildPdf(['Quarterly planning notes with no sensitive data.']);

    const result = await service.scan(pdf, 'application/pdf');

    expect(result.status).toBe('CLEAR');
  });

  it('skips unsupported binary types instead of scanning raw bytes', async () => {
    // Random bytes that would trip the phone regex if decoded as UTF-8.
    const binary = Buffer.from([0x00, 0x30, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0xff]);

    const result = await service.scan(binary, 'application/octet-stream');

    expect(result).toEqual({ status: 'CLEAR', findings: [] });
  });
});
