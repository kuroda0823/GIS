import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname の代わり（ES Modules用）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// CSVと出力ファイルのパスを設定
const csvFilePath = path.resolve(__dirname, 'data/opendata_1519.csv')
const outputGeoJSONPath = path.resolve(__dirname, 'public/public_parks.geojson')

// 住所から「区名」を自動判定する関数
function extractWard(address: string): string {
  if (address.includes('北区')) return '北区'
  if (address.includes('中区')) return '中区'
  if (address.includes('東区')) return '東区'
  if (address.includes('南区')) return '南区'
  return 'その他'
}

// 簡易CSVパーサー（カンマ区切り・ダブルクォーテーション対応）
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result.map((item) => item.replace(/^"|"$/g, ''))
}




function convertCsvToGeoJson() {
  if (!fs.existsSync(csvFilePath)) {
    console.error(`エラー: ${csvFilePath} が見つかりません。data/ フォルダ内に opendata_1519.csv を配置してください。`)
    return
  }

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '')

  if (lines.length <= 1) {
    console.error('エラー: CSVデータが空か、ヘッダーしかありません。')
    return
  }

  const headers = parseCSVLine(lines[0])
  const nameIdx = headers.findIndex((h) => h.includes('名称') || h.includes('公園名'))
  const lngIdx = headers.findIndex((h) => h.includes('経度'))
  const latIdx = headers.findIndex((h) => h.includes('緯度'))
  const catIdx = headers.findIndex((h) => h.includes('分類') || h.includes('種別'))
  const addrIdx = headers.findIndex((h) => h.includes('住所') || h.includes('所在地'))

  if (nameIdx === -1 || lngIdx === -1 || latIdx === -1) {
    console.error('エラー: CSVに「名称」「経度」「緯度」の列が見つかりません。')
    return
  }

  const features: any[] = []
  let currentId = 1

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    if (row.length < headers.length) continue

    const name = row[nameIdx]
    const rawLng = row[lngIdx]
    const rawLat = row[latIdx]
    const category = catIdx !== -1 ? row[catIdx] : '未分類'
    const address = addrIdx !== -1 ? row[addrIdx] : ''

    // 【除外判定 1】必須項目の空欄チェック
    if (!name || !rawLng || !rawLat) {
      console.warn(`[除外] 行 ${i + 1}: 名称・座標が空欄のためスキップしました。`)
      continue
    }

    const lng = parseFloat(rawLng)
    const lat = parseFloat(rawLat)

    // 【除外判定 2】数値チェック
    if (isNaN(lng) || isNaN(lat)) {
      console.warn(`[除外] 行 ${i + 1} (${name}): 座標が数値でないためスキップしました。`)
      continue
    }

    // 【除外判定 3】範囲チェック（日本国内の座標範囲）
    if (lng < 120 || lng > 150 || lat < 20 || lat > 50) {
      console.warn(`[除外] 行 ${i + 1} (${name}): 座標が範囲外のためスキップしました。`)
      continue
    }

    // 住所から行政区（北区・中区・東区・南区）を抽出
    const ward = extractWard(address)

    // 正常なデータを GeoJSON Feature として追加
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      properties: {
        id: currentId++,
        name: name,
        category: category,
        address: address,
        ward: ward, // ★ 行政区の追加
      },
    })
  }

  const geojson = {
    type: 'FeatureCollection',
    features: features,
  }

  // public フォルダが存在しない場合は作成
  const publicDir = path.dirname(outputGeoJSONPath)
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  fs.writeFileSync(outputGeoJSONPath, JSON.stringify(geojson, null, 2), 'utf-8')
  console.log(`成功: ${features.length} 件の公園データ（区情報付き）を public/public_parks.geojson に出力しました！`)
}

convertCsvToGeoJson()