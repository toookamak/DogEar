// DogEar Chrome 扩展 · 弹出页
// 保存当前标签页：POST {addr}/api/skill/save_bookmark（Bearer Skill Token，source=extension）。
// 配置存 chrome.storage.sync；保存带 Idempotency-Key，服务端 24h 内同 key 重放不重复入库。

const DEFAULTS = { addr: '', token: '' }

async function getConfig() {
  return { ...DEFAULTS, ...(await chrome.storage.sync.get(['addr', 'token'])) }
}

function normalizeAddr(addr) {
  return (addr ?? '').trim().replace(/\/+$/, '')
}

function showStatus(kind, html) {
  const el = document.getElementById('status')
  el.className = `status ${kind}`
  el.innerHTML = html
}

function showErrorHint(text) {
  const el = document.getElementById('error-hint')
  el.textContent = text
  el.style.display = 'block'
}

async function saveCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !/^https?:/.test(tab.url)) {
    document.getElementById('page-title').textContent = '当前页面无法添加'
    return null
  }
  document.getElementById('page-title').textContent = tab.title || tab.url
  document.getElementById('page-url').textContent = tab.url
  return { url: tab.url, title: tab.title }
}

async function save() {
  const config = await getConfig()
  const addr = normalizeAddr(config.addr)
  const button = document.getElementById('save')
  const note = document.getElementById('note').value.trim()
  button.disabled = true
  try {
    const response = await fetch(`${addr}/api/skill/save_bookmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ url: page.url, note: note || undefined, source: 'extension' }),
    })
    if (response.status === 401 || response.status === 403) {
      showStatus('err', 'Token 无效或添加能力已关闭。')
      return
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const message = body?.error?.message ?? `HTTP ${response.status}`
      showStatus('err', `添加失败：${message}`)
      return
    }
    const saved = await response.json()
    // 首次保存返回扁平 receipt；24h 内同 Idempotency-Key 重放返回 {bookmark,...} 包裹，两者都兼容
    const receipt = saved.bookmark ?? saved
    const suggestions = Array.isArray(receipt.suggestions) ? receipt.suggestions.length : 0
    showStatus(
      'ok',
      (saved.replay ? '该链接此前已添加（幂等重放）。' : '已添加。') +
      (suggestions > 0 ? `${suggestions} 条整理建议待你在工作台确认。` : ''),
    )
  } catch (error) {
    showStatus('err', '连接失败：请检查地址是否可达、协议是否正确。')
  } finally {
    button.disabled = false
  }
}

let page = null

document.getElementById('save').addEventListener('click', () => { void save() })
document.getElementById('go-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
document.getElementById('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage())

void (async () => {
  page = await saveCurrentTab()
  const config = await getConfig()
  const addr = normalizeAddr(config.addr)
  document.getElementById('addr').textContent = addr || '未配置'
  const configured = Boolean(addr && config.token)
  document.getElementById('setup').style.display = configured ? 'none' : 'block'
  document.getElementById('form').style.display = configured ? 'block' : 'none'
  if (!configured) {
    showErrorHint('配置方法见扩展说明：填 DogEar 地址与 Skill Token。')
  }
})()
