import { env } from '../../config/env.js';
import { GeoapifyMapProvider } from './geoapifyMapProvider.js';
import type { MapProvider } from './mapProvider.js';

function createMapProvider(): MapProvider {
  switch (env.MAP_PROVIDER) {
    case 'geoapify':
      return new GeoapifyMapProvider(env.MAP_PROVIDER_API_KEY);
  }
}

export const mapProvider: MapProvider = createMapProvider();

export type { Address, Coordinates, DistanceMatrix, DistanceMatrixCell, MapProvider, Route } from './mapProvider.js';
