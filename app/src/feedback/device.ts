import * as Device from 'expo-device';
import { Dimensions, PixelRatio } from 'react-native';

/** The device a report came from. Fields are null where the platform doesn't say. */
export interface DeviceInfo {
  /** Like "Samsung SM-X200", or null on web. */
  model: string | null;
  os: string | null;
  osVersion: string | null;
  /** The whole screen in density-independent pixels, as the device is held now. */
  screen: { width: number; height: number; scale: number };
}

export function deviceInfo(): DeviceInfo {
  const maker = Device.manufacturer ?? Device.brand;
  const name = Device.modelName;
  let model = name ?? null;
  if (maker && name && !name.toLowerCase().startsWith(maker.toLowerCase()))
    model = `${maker} ${name}`;
  const { width, height } = Dimensions.get('screen');
  return {
    model,
    os: Device.osName,
    osVersion: Device.osVersion,
    screen: { width, height, scale: PixelRatio.get() },
  };
}
