// DogEar Chrome 扩展 · 设置页
// 配置存 chrome.storage.sync；「测试连通」打 /.well-known/capabilities（无需鉴权，验证地址可达）。

function normalizeAddr(addr) {
  return (addr ?? '').trim().replace(/\/+$/, '')
}

function showMessage(kind, text) {
  const el = document.getElementById('message')
  el.className = kind
  el.textContent = text
}

document.getElementById('save-config').addEventListener('click', async () => {
  const addr = normalizeAddr(document.getElementById('addr').value)
  const token = document.getElementById('token').value.trim()
  if (!addr || !/^https?:\/\//.test(addr)) {
    showMessage('err', '请填写以 http(s):// 开头的 DogEar 地址。')
    return
  }
  if (!token) {
    showMessage('err', '请填写 Skill Token。')
    return
  }
  await chrome.storage.sync.set({ addr, token })
  showMessage('ok', '已保存。回到任意页面点扩展图标即可保存。')
})

document.getElementById('test').addEventListener('click', async () => {
  const addr = normalizeAddr(document.getElementById('addr').value)
  if (!addr) {
    showMessage('err', '请先填写地址。')
    return
  }
  try {
    const response = await fetch(`${addr}/.well-known/capabilities`)
    if (!response.ok) {
      showMessage('err', `地址可达但返回异常（HTTP ${response.status}）。`)
      return
    }
    const caps = await response.json()
    showMessage('ok', `连通成功：${caps.name ?? 'DogEar'}（${(caps.skills ?? []).length} 个技能可用）。`)
  } catch {
    showMessage('err', '无法连接：检查地址与网络（本地联调地址形如 http://127.0.0.1:8787）。')
  }
})

void (async () => {
  const { addr, token } = await chrome.storage.sync.get(['addr', 'token'])
  document.getElementById('addr').value = addr ?? ''
  document.getElementById('token').value = token ?? ''
})()
