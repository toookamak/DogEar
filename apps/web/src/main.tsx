import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Bookmark } from '@dogear/shared'
import './styles.css'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

function App() {
  const [url, setUrl] = useState('')
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [error, setError] = useState('')

  async function loadBookmarks() {
    const response = await fetch(`${apiUrl}/api/bookmarks`)
    if (!response.ok) throw new Error('加载书签失败')
    setBookmarks(await response.json())
  }

  useEffect(() => {
    loadBookmarks().catch((cause: Error) => setError(cause.message))
  }, [])

  async function saveBookmark(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const response = await fetch(`${apiUrl}/api/bookmarks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!response.ok) {
      setError('保存书签失败')
      return
    }
    setUrl('')
    await loadBookmarks()
  }

  return <main>
    <h1>DogEar</h1>
    <form onSubmit={saveBookmark}>
      <input aria-label="书签 URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="粘贴 URL" />
      <button type="submit">保存</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <ul>{bookmarks.map((bookmark) => <li key={bookmark.id}><a href={bookmark.url}>{bookmark.url}</a></li>)}</ul>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
