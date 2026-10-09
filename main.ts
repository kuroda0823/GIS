import { Map, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

const map = new Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution:
          '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      },
    },
    layers: [
      {
        id: 'gsi-base',
        type: 'raster',
        source: 'gsi',
      },
    ],
  },
  center: [133.918, 34.662], // 岡山市中心部の座標 [経度, 緯度]
  zoom: 14,
})

map.addControl(new NavigationControl(), 'top-right')