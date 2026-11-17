import { describeUpload, lastFeedbackEvent, noteFeedback } from './status';

describe('feedback status', () => {
  it('keeps the last event', () => {
    const at = new Date('2026-11-17T04:00:00Z');
    noteFeedback('Report sent.', at);
    expect(lastFeedbackEvent()).toEqual({ at, text: 'Report sent.' });
  });

  it('says whether an upload will retry', () => {
    expect(describeUpload(201)).toBe('Report sent.');
    expect(describeUpload(null)).toMatch(/Will retry/);
    expect(describeUpload(503)).toMatch(/503\. Will retry/);
    expect(describeUpload(400)).toBe('The server refused the report (400).');
  });
});
