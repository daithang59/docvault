import { DlpScannerService } from './dlp-scanner.service';

describe('DlpScannerService', () => {
  let service: DlpScannerService;

  beforeEach(() => {
    service = new DlpScannerService();
  });

  it('detects sensitive contact and keyword patterns', () => {
    const result = service.scan(
      Buffer.from('Internal only file. Contact ceo@example.com or 0901234567.'),
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

  it('returns CLEAR when no DLP pattern is present', () => {
    expect(service.scan(Buffer.from('normal project document'))).toEqual({
      status: 'CLEAR',
      findings: [],
    });
  });
});
