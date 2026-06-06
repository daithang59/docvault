import { parseMentions } from './mentions.util';

describe('parseMentions', () => {
  it('extracts a single mention', () => {
    expect(parseMentions('hey @alice please review')).toEqual(['alice']);
  });

  it('extracts multiple mentions in order without duplicates', () => {
    expect(parseMentions('@bob and @alice and @bob again')).toEqual(['bob', 'alice']);
  });

  it('matches a mention at the start of the text', () => {
    expect(parseMentions('@carol look here')).toEqual(['carol']);
  });

  it('ignores email-like addresses (@ mid-word)', () => {
    expect(parseMentions('contact me at bob@example.com')).toEqual([]);
  });

  it('supports dotted and dashed usernames and trims trailing punctuation', () => {
    expect(parseMentions('ping @first.last, and @user-99.')).toEqual(['first.last', 'user-99']);
  });

  it('returns empty for no mentions or empty input', () => {
    expect(parseMentions('no mentions here')).toEqual([]);
    expect(parseMentions('')).toEqual([]);
  });

  it('matches mentions after a parenthesis or bracket', () => {
    expect(parseMentions('(@dave) [@erin]')).toEqual(['dave', 'erin']);
  });
});
