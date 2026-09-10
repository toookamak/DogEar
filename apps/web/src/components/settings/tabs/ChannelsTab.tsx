import { ChannelManager } from '../../channels/ChannelManager.js'

/**
 * 输入源 / 导出：通道配置（Raindrop / S3 / WebDAV）、连通测试、导入与导出、备份下载入口。
 * 内容由既有 ChannelManager 承载，本分区只做设置页内的落位。
 */
export function ChannelsTab() {
  return <ChannelManager />
}
