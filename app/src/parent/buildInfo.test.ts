import { buildInfoRows, type BuildInfo } from './buildInfo';

const base: BuildInfo = {
  appVersion: '1.0.0',
  runtimeVersion: 'abc123',
  updatesEnabled: true,
  isEmbeddedLaunch: true,
  updateId: '0f1e2d3c-aaaa-bbbb-cccc-ddddeeeeffff',
  createdAt: new Date(2026, 10, 7, 9, 5),
};

const update = (info: BuildInfo) => buildInfoRows(info, '2026.11.07-53')[2][1];

describe('buildInfoRows', () => {
  it('lists versions and the content bundle', () => {
    expect(buildInfoRows(base, '2026.11.07-53')).toEqual([
      ['App version', '1.0.0'],
      ['Runtime version', 'abc123'],
      ['Update', 'None yet (running the installed version)'],
      ['Content bundle', '2026.11.07-53'],
    ]);
  });

  it('shows the downloaded update with its publish time', () => {
    expect(update({ ...base, isEmbeddedLaunch: false })).toBe(
      '0f1e2d3c, published 2026-11-07 09:05',
    );
  });

  it('says when the build has updates off', () => {
    expect(update({ ...base, updatesEnabled: false })).toBe('Off in this build');
  });
});
