// 封面动态背景的参数换算。播放详情页用它生成 CSS 变量，参数面板用它显示当前值，
// 两边共用同一份换算，避免面板显示的值和实际效果对不上。
export const ARTWORK_SETTING_KEYS = {
  motion: 'playDetail.artworkBackground.motion',
  speed: 'playDetail.artworkBackground.speed',
  intensity: 'playDetail.artworkBackground.intensity',
  duration: 'playDetail.artworkBackground.duration',
} as const

/** 流动幅度（0-100）-> 漂移动画的缩放区间 */
export const getZoomRange = (motion: number): [string, string] => [
  (1 + (motion / 100) * 0.02).toFixed(3),
  (1.04 + (motion / 100) * 0.14).toFixed(3),
]

/** 流动速度（0-100）-> 漂移一个来回的时长 */
export const getDriftDuration = (speed: number): string => `${(48 - (speed / 100) * 36).toFixed(1)}s`

/** 过渡时长（0-100）-> 换歌时颜色插值的秒数 */
export const getMorphDuration = (duration: number): string =>
  `${(0.6 + (duration / 100) * 3.4).toFixed(2)}s`

/** 背景浓度（0-100）-> 主题底色遮罩的两层不透明度 */
export const getVeilOpacity = (intensity: number) => {
  const veil = 0.92 - (intensity / 100) * 0.72
  return { veil: veil.toFixed(3), inner: (veil * 0.45).toFixed(3) }
}
