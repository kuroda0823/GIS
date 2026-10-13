//import：別ファイルのデータ、ファイル自身、なんでも呼び出せる

//maplibre-gl(外部ツール)から、Map, NavigationControl(関数やクラス)を読み込む
import { Map, NavigationControl } from 'maplibre-gl'
//maplibre-glのなかのcssファイルを読み込む
import 'maplibre-gl/dist/maplibre-gl.css'
//自分のcssファイルを読み込む
import './style.css'


// 1. 地図オブジェクトの作成

const map = new Map({
  container: 'map',           //地図を埋め込むHTMLのIDを指定

  style: {
    version: 8,

    //どこから地図画像を引っ張ってくるか(sources)を指定
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


    //読み込んだデータをどう画面に表示するか(layers)を指定
    layers: [
      {
        id: 'gsi-base',   //レイヤーのID
        type: 'raster',   //ラスタ(画像)として表示
        source: 'gsi',    // sources で定義した'gsi'データ
      },
    ],
  },

  //地図の初期表示位置とズームレベルを指定
  center: [133.918, 34.662],   // 岡山市中心部の座標 [経度, 緯度]
  zoom: 14,
})


//2. コントロールの追加
//作成したmapに、ズーム操作用ボタンの部品(NavigationControl)を『右上』に配置

map.addControl(new NavigationControl(), 'top-right')


//3. 公園データ(GeoJSON)の準備と描画

//表示したい公園データ(点と面)をオブジェクトとして定義
const parkGeoJSON: any = {
  type: 'FeatureCollection',
  features: [
    // 【Point】ひみつの基地公園（点データ）
    {
      type: 'Feature',
      properties: {
        name: 'ひみつの基地公園',
      },
      geometry: {
        type: 'Point',
        coordinates: [133.918, 34.662], // 岡山市中心部の座標 [経度, 緯度]
      },
    },
    // 【Polygon】ひみつの基地公園の敷地（面データ）
    {
      type: 'Feature',
      properties: {
        name: 'ひみつの基地公園の敷地',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [133.916, 34.661],
            [133.920, 34.661],
            [133.920, 34.663],
            [133.916, 34.663],
            [133.916, 34.661], // 面を閉じるため最初の座標と同じにする
          ],
        ],
      },
    },
  ],
}

//地図の背景画像などの準備が完全に終わったら(load)、公園データを追加する
map.on('load', () => {

  //① データソースの追加：公園データを 'park-data' というニックネームで地図に登録
  map.addSource('park-data', {
    type: 'geojson',
    data: parkGeoJSON,
  })

  //② Polygon(面)の塗りつぶし表示設定
  map.addLayer({
    id: 'park-polygon-fill',    //レイヤーのID(ニックネーム)
    type: 'fill',                //塗りつぶし(面)として表示
    source: 'park-data',         //上で登録した 'park-data' を使う
    filter: ['==', '$type', 'Polygon'], //データの種類が 'Polygon' のものだけに適用
    paint: {
      'fill-color': '#22c55e',   //塗りつぶしの色(緑色)
      'fill-opacity': 0.4,       //透明度(0.4 = 40%)
    },
  })

  //③ Polygon(面)の枠線表示設定
  map.addLayer({
    id: 'park-polygon-outline', //レイヤーのID
    type: 'line',                //線として表示
    source: 'park-data',
    filter: ['==', '$type', 'Polygon'], // 'Polygon' のものだけに適用
    paint: {
      'line-color': '#15803d',   //線の色(濃い緑色)
      'line-width': 2,           //線の太さ(2ピクセル)
    },
  })

  //④ Point(点)の円マーク表示設定
  map.addLayer({
    id: 'park-point',            //レイヤーのID
    type: 'circle',              //丸印(円)として表示
    source: 'park-data',
    filter: ['==', '$type', 'Point'], //データの種類が 'Point' のものだけに適用
    paint: {
      'circle-radius': 8,        //円の大きさ(半径8ピクセル)
      'circle-color': '#ef4444',  //円の色(赤色)
      'circle-stroke-width': 2,  //円のフチの太さ
      'circle-stroke-color': '#ffffff', //円のフチの色(白色)
    },
  })
})