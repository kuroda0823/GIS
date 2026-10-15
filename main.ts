import { Map, NavigationControl, Popup, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

// 1. 地図オブジェクトの作成
const map = new Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      gsi: {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      },
    },
    layers: [{ id: 'gsi-base', type: 'raster', source: 'gsi' }],
  },
  center: [133.918, 34.662],
  zoom: 12,
})

map.addControl(new NavigationControl(), 'top-right')

let allParks: any[] = []
let clickedPoint: [number, number] | null = null
let clickMarker: Marker | null = null
let currentPopup: Popup | null = null

// 2点間の距離をメートル単位で計算（ヒュベニの公式：地球の丸みも考慮して計算してる）
function calculateDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const [lng1, lat1] = coord1
  const [lng2, lat2] = coord2
  const R = 6371000 // 地球の半径 (m)
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

// 距離のフォーマット表示 (m / km)
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`
  }
  return `${meters} m`
}

map.on('load', async () => {
  try {
    const response = await fetch('/public_parks.geojson')
    if (!response.ok) throw new Error('GeoJSONの読み込みに失敗しました')

    const geojson = await response.json()
    allParks = geojson.features || []

    if (allParks.length === 0) {
      showError('公園データが見つかりませんでした。')
      return
    }

    // 区（行政区）ドロップダウンの選択肢を動的生成
    initWards(allParks)

    // 地図データソースの登録
    map.addSource('public-parks-data', {
      type: 'geojson',
      data: geojson,
      generateId: true,
    })

    // 最寄り公園と結ぶ線用ソースの登録
    map.addSource('connecting-line-data', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    // 接続線のレイヤー描画（点線）
    map.addLayer({
      id: 'connecting-line-layer',
      type: 'line',
      source: 'connecting-line-data',
      paint: {
        'line-color': '#e74c3c',
        'line-width': 3,
        'line-dasharray': [2, 2],
      },
    })

    // 公園ピンのレイヤー描画
    map.addLayer({
      id: 'public-parks-layer',
      type: 'circle',
      source: 'public-parks-data',
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'nearest'], false], 11,
          ['boolean', ['feature-state', 'selected'], false], 10,
          7,
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'nearest'], false], '#e74c3c',
          '#42b883',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    })

    setupEvents()
    updateFilterAndList()
  } catch (err: any) {
    showError(`読み込みエラー: ${err.message}`)
  }
})

//クリック時のイベント
function setupEvents() {
  // 地図クリック時
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['public-parks-layer'] })
    if (features.length > 0) return

    const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat]
    clickedPoint = lngLat

    if (!clickMarker) {
      clickMarker = new Marker({ color: '#e74c3c' }).setLngLat(lngLat).addTo(map)
    } else {
      clickMarker.setLngLat(lngLat)
    }

    const clickInfoEl = document.getElementById('click-info')
    if (clickInfoEl) clickInfoEl.style.display = 'flex'

    updateFilterAndList()
  })

  // ピンクリック時
  map.on('click', 'public-parks-layer', (e) => {
    if (!e.features || e.features.length === 0) return
    selectPark(e.features[0])
  })

  // 画面移動時
  map.on('moveend', () => {
    const inBoundsCheckbox = document.getElementById('search-in-bounds') as HTMLInputElement
    if (inBoundsCheckbox && inBoundsCheckbox.checked) {
      updateFilterAndList()
    }
  })

  // 検索イベント
  document.getElementById('search-name')?.addEventListener('input', updateFilterAndList)
  document.getElementById('search-ward')?.addEventListener('change', updateFilterAndList)
  document.getElementById('search-in-bounds')?.addEventListener('change', updateFilterAndList)

  // 選択解除ボタン
  document.getElementById('reset-click-btn')?.addEventListener('click', () => {
    clickedPoint = null
    if (clickMarker) {
      clickMarker.remove()
      clickMarker = null
    }
    const clickInfoEl = document.getElementById('click-info')
    if (clickInfoEl) clickInfoEl.style.display = 'none'

    clearConnectingLine()
    updateFilterAndList()
  })
}

// フィルター処理・ソート・描画
function updateFilterAndList() {
  const nameQuery = (document.getElementById('search-name') as HTMLInputElement)?.value.trim().toLowerCase() || ''
  const wardQuery = (document.getElementById('search-ward') as HTMLSelectElement)?.value || ''
  const inBoundsOnly = (document.getElementById('search-in-bounds') as HTMLInputElement)?.checked || false

  const bounds = map.getBounds()

  // 1. 絞り込み（名前・区・画面内）
  let filtered = allParks.filter((feature) => {
    const name = (feature.properties.name || '').toLowerCase()
    const ward = feature.properties.ward || ''
    const [lng, lat] = feature.geometry.coordinates

    const matchName = name.includes(nameQuery)
    const matchWard = !wardQuery || ward === wardQuery
    const matchBounds = !inBoundsOnly || bounds.contains([lng, lat])

    return matchName && matchWard && matchBounds
  })

  let nearestId: number | null = null

  // 2. 距離計算 ＆ ソート
  if (clickedPoint && filtered.length > 0) {
    filtered = filtered.map((feature) => {
      const coords = feature.geometry.coordinates as [number, number]
      const dist = calculateDistanceMeters(clickedPoint!, coords)
      return { ...feature, _distance: dist }
    })

    filtered.sort((a, b) => a._distance - b._distance)
    nearestId = filtered[0].properties.id

    drawConnectingLine(clickedPoint, filtered[0].geometry.coordinates)
  } else {
    clearConnectingLine()
  }

  // 3. 地図上のソースを更新
  const source = map.getSource('public-parks-data') as any
  if (source) {
    source.setData({ type: 'FeatureCollection', features: filtered })
  }

  // 4. 最寄り状態更新
  allParks.forEach((p) => {
    map.setFeatureState(
      { source: 'public-parks-data', id: p.properties.id },
      { nearest: p.properties.id === nearestId }
    )
  })

  // 5. リスト描画
  renderList(filtered, nearestId)
}

// リスト描画
function renderList(parks: any[], nearestId: number | null) {
  const listEl = document.getElementById('park-list')
  const errorEl = document.getElementById('error-message')
  if (!listEl || !errorEl) return

  listEl.innerHTML = ''

  if (parks.length === 0) {
    errorEl.style.display = 'block'
    errorEl.textContent = '該当する公園が見つかりません。検索条件を変更してください。'
    return
  } else {
    errorEl.style.display = 'none'
  }

  parks.forEach((feature) => {
    const props = feature.properties
    const coords = feature.geometry.coordinates
    const isNearest = props.id === nearestId

    const li = document.createElement('li')
    li.className = `park-item ${isNearest ? 'nearest' : ''}`
    li.dataset.id = String(props.id)

    const headerDiv = document.createElement('div')
    headerDiv.className = 'park-item-header'

    const nameSpan = document.createElement('span')
    nameSpan.className = 'park-name'
    nameSpan.textContent = (isNearest ? '⭐ ' : '') + props.name

    headerDiv.appendChild(nameSpan)

    if (feature._distance !== undefined) {
      const distSpan = document.createElement('span')
      distSpan.className = 'park-distance'
      distSpan.textContent = formatDistance(feature._distance)
      headerDiv.appendChild(distSpan)
    }

    const metaDiv = document.createElement('div')
    metaDiv.className = 'park-meta'
    metaDiv.textContent = `エリア: ${props.ward || 'その他'}`

    li.appendChild(headerDiv)
    li.appendChild(metaDiv)

    li.addEventListener('click', () => {
      map.flyTo({ center: coords, zoom: 15, speed: 1.2 })
      selectPark(feature)
    })

    listEl.appendChild(li)
  })
}

// ポップアップ選択
function selectPark(feature: any) {
  const props = feature.properties
  const coords = feature.geometry.coordinates

  if (currentPopup) currentPopup.remove()

  const popupContent = document.createElement('div')

  const title = document.createElement('h4')
  title.textContent = props.name

  const wardInfo = document.createElement('p')
  wardInfo.textContent = `エリア: ${props.ward || 'その他'}`

  const source = document.createElement('p')
  source.style.fontSize = '11px'
  source.style.color = '#888'
  source.textContent = '出典: 岡山市オープンデータ'

  popupContent.appendChild(title)
  popupContent.appendChild(wardInfo)
  popupContent.appendChild(source)

  currentPopup = new Popup()
    .setLngLat(coords)
    .setDOMContent(popupContent)
    .addTo(map)

  document.querySelectorAll('.park-item').forEach((el) => el.classList.remove('active'))
  const target = document.querySelector(`.park-item[data-id="${props.id}"]`)
  if (target) {
    target.classList.add('active')
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

//クリックした地点（from）から一番近い公園（to）へ赤い点線を引く
function drawConnectingLine(from: [number, number], to: [number, number]) {
  const source = map.getSource('connecting-line-data') as any
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [from, to] }, properties: {} }],
    })
  }
}

//地図上に引いた赤い点線を消して、クリアにする
function clearConnectingLine() {
  const source = map.getSource('connecting-line-data') as any
  if (source) {
    //FeatureCollectionとfeaturesの配列[]を0(クリア)にしてる
    source.setData({ type: 'FeatureCollection', features: [] })
  }
}

// 区のドロップダウン選択肢つくる
function initWards(parks: any[]) {
  const select = document.getElementById('search-ward') as HTMLSelectElement
  if (!select) return

  // データに含まれる区(北区・中区・東区・南区)のリストを重複なしで作成
  const wards = Array.from(new Set(parks.map((p) => p.properties.ward).filter(Boolean))).sort()

  wards.forEach((ward) => {
    const opt = document.createElement('option')
    opt.value = ward
    opt.textContent = ward
    select.appendChild(opt)
  })
}

//エラー表示の処理をshowErrorとしてまとめておいて
// トラブルが起きたら『showError('エラー理由')』と呼び出す
function showError(message: string) {
  const errorEl = document.getElementById('error-message')
  if (errorEl) {
    errorEl.style.display = 'block'
    errorEl.textContent = message
  }
}