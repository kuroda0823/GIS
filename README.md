# GIS 公園探索アプリケーション (Web GIS App)

岡山市内の公園を探索できるアプリケーションです。

---

## 📋 概要・検証目的

本プロジェクトでは以下のGIS空間解析機能の実装および動作検証を行っています。

1. **空間検索（Point in Polygon）の検証**
   - Turf.jsを用いた厳密な空間判定（穴のあるPolygon / MultiPolygonの解釈）
   - BBOX（緯度経度の最小・最大値による簡易判定）と厳密判定の精度比較および誤判定ケースの証明
2. **距離計算・描画**
   - クリック地点から最寄りスポットへの距離算出
   - 直線（LineString）のリアルタイム描画

---

## 🛠 動作環境・技術スタック

- **Node.js**: v18.0.0 以上推奨
- **言語**: TypeScript
- **ビルドツール / Webサーバー**: Vite (または Webpack / Parcel)
- **ライブラリ**:
  - [Leaflet](https://leafletjs.js.org/) (地図描画)
  - [@turf/turf](https://turfjs.org/) (空間解析)

---

## 🚀 セットアップと起動手順

第三者環境（クローン直後）で起動するための手順です。

### 1. リポジトリのクローン
```bash
git clone https://github.com/kuroda0823/GIS.git
cd GIS

