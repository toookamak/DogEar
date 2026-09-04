const BASE = ''

export const exportApi = {
  html: (id: string) => `${BASE}/api/bookmarks/${id}/export/html`,
  markdown: (id: string) => `${BASE}/api/bookmarks/${id}/export/markdown`,
  downloadHtml: (id: string, title: string) => {
    const a = document.createElement('a')
    a.href = exportApi.html(id)
    a.download = `${title || 'bookmark'}.html`
    a.click()
  },
  downloadMarkdown: (id: string, title: string) => {
    const a = document.createElement('a')
    a.href = exportApi.markdown(id)
    a.download = `${title || 'bookmark'}.md`
    a.click()
  },
}