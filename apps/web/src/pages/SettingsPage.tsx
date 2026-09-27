import { useState } from 'react'
import { useSearchParams } from 'wouter'
import { PageHeader } from '../components/layout/PageHeader.js'
import { StatusTab } from '../components/settings/tabs/StatusTab.js'
import { ChannelsTab } from '../components/settings/tabs/ChannelsTab.js'
import { BackupTab } from '../components/settings/tabs/BackupTab.js'
import { AgentTab } from '../components/settings/tabs/AgentTab.js'
import { LogTab } from '../components/settings/tabs/LogTab.js'
import { TrashTab } from '../components/settings/tabs/TrashTab.js'
import { AppearanceTab } from '../components/settings/tabs/AppearanceTab.js'

/**
 * 分区沿用原型 SettingsModal 的六分区（状态信息 / 输入源 / 备份 / Agent / 日志 / 回收站），
 * 但落位为独立路由页而非模态：正式工程的 /settings 路由与侧栏入口已存在，改为模态会牵动导航结构。
 * 深色主题上线后追加「外观」分区，置于末位不打扰既有顺序。
 */
const TABS = [
  { key: 'status', label: '状态信息' },
  { key: 'channels', label: '输入源 / 导出' },
  { key: 'backup', label: '备份与恢复' },
  { key: 'agent', label: 'Agent 接入' },
  { key: 'log', label: '日志' },
  { key: 'trash', label: '回收站' },
  { key: 'appearance', label: '外观' },
] as const

type TabKey = typeof TABS[number]['key']

export function SettingsPage() {
  // ?tab= 直达分区（状态栏同步卡片的「管理冲突」跳 /settings?tab=channels 用）；
  // 仅在挂载时读一次，之后仍是页内状态切换
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>(() => {
    const requested = searchParams.get('tab')
    return TABS.some((item) => item.key === requested) ? (requested as TabKey) : 'status'
  })

  return (
    <div>
      <PageHeader title="设置" />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分区">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="settings-tab"
              aria-current={tab === item.key ? 'true' : undefined}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {tab === 'status' && <StatusTab />}
          {tab === 'channels' && <ChannelsTab />}
          {tab === 'backup' && <BackupTab />}
          {tab === 'agent' && <AgentTab />}
          {tab === 'log' && <LogTab />}
          {tab === 'trash' && <TrashTab />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  )
}
