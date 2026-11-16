import { Dimensions, PixelRatio } from 'react-native';

import { deviceInfo } from './device';

jest.mock('expo-device', () => ({
  __esModule: true,
  manufacturer: null,
  brand: null,
  modelName: null,
  osName: 'Android',
  osVersion: '15',
}));
const device: Record<string, string | null> = jest.requireMock('expo-device');

describe('deviceInfo', () => {
  beforeEach(() => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 800, height: 1280, scale: 2, fontScale: 1 });
    jest.spyOn(PixelRatio, 'get').mockReturnValue(2);
  });

  it('joins the maker and the model', () => {
    Object.assign(device, { manufacturer: 'Samsung', modelName: 'SM-X200' });
    expect(deviceInfo()).toEqual({
      model: 'Samsung SM-X200',
      os: 'Android',
      osVersion: '15',
      screen: { width: 800, height: 1280, scale: 2 },
    });
  });

  it('keeps a model name that already starts with the maker', () => {
    Object.assign(device, { manufacturer: 'Google', modelName: 'Google Pixel 8' });
    expect(deviceInfo().model).toBe('Google Pixel 8');
  });

  it('reports no model when the platform gives none', () => {
    Object.assign(device, { manufacturer: null, brand: null, modelName: null });
    expect(deviceInfo().model).toBeNull();
  });
});
