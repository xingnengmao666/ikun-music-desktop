<template lang="pug">
transition(enter-active-class="animated slideInRight" leave-active-class="animated slideOutDown" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen }]" @contextmenu="handleContextMenu")
    div(:class="$style.artworkBg" aria-hidden="true" :style="artworkStyle")
    div(:class="$style.bg" :style="artworkVeilStyle")
    //- div(:class="$style.bg" :style="bgStyle")
    //- div(:class="$style.bg2")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    div(:class="[$style.main, {[$style.showComment]: isShowPlayComment}]")
      div.left(:class="$style.left")
        //- div(:class="$style.info")
        div(:class="$style.info")
          img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
          div.description(:class="['scroll', $style.description]")
            p {{ $t('player__music_name') }}{{ musicInfo.name }}
            p {{ $t('player__music_singer') }}{{ musicInfo.singer }}
            p(v-if="musicInfo.album") {{ $t('player__music_album') }}{{ musicInfo.album }}

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      play-bar(v-if="visibled")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled")
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { colorsToCss, getArtworkColors } from '@renderer/utils/colorExtract'
import {
  ARTWORK_SETTING_KEYS,
  getDriftDuration,
  getMorphDuration,
  getVeilOpacity,
  getZoomRange,
} from '@renderer/utils/artworkBackground'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
  },
  setup() {
    const visibled = ref(false)

    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()

      visibled.value = true
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
    }

    watch(isFullscreen, (isFullscreen) => {
      ;(isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    // 播放详情页的动态背景：从当前歌曲封面上取色，只写进 CSS 变量，
    // 渐变的形状固定，换歌时由浏览器插值这几个颜色（详见 @renderer/utils/colorExtract）
    const ARTWORK_TRANSPARENT = 'transparent'
    const artworkColors = ref([
      ARTWORK_TRANSPARENT,
      ARTWORK_TRANSPARENT,
      ARTWORK_TRANSPARENT,
      ARTWORK_TRANSPARENT,
    ])
    let artworkToken = 0

    const artworkStyle = computed(() => {
      const [zoomFrom, zoomTo] = getZoomRange(appSetting[ARTWORK_SETTING_KEYS.motion])
      return {
        '--artwork-c0': artworkColors.value[0],
        '--artwork-c1': artworkColors.value[1],
        '--artwork-c2': artworkColors.value[2],
        '--artwork-c3': artworkColors.value[3],
        '--artwork-zoom-from': zoomFrom,
        '--artwork-zoom-to': zoomTo,
        '--artwork-speed': getDriftDuration(appSetting[ARTWORK_SETTING_KEYS.speed]),
        transitionDuration: getMorphDuration(appSetting[ARTWORK_SETTING_KEYS.duration]),
      }
    })

    // 没有取到色时把主题底色遮罩恢复成不透明，界面跟没开这个功能时一致
    const artworkVeilStyle = computed(() => {
      if (artworkColors.value[0] === ARTWORK_TRANSPARENT) return {}
      const { veil, inner } = getVeilOpacity(appSetting[ARTWORK_SETTING_KEYS.intensity])
      return { '--artwork-veil': veil, '--artwork-veil-inner': inner }
    })

    const clearArtworkBackground = () => {
      artworkToken++
      artworkColors.value = [
        ARTWORK_TRANSPARENT,
        ARTWORK_TRANSPARENT,
        ARTWORK_TRANSPARENT,
        ARTWORK_TRANSPARENT,
      ]
    }

    const setArtworkBackground = async (pic) => {
      const token = ++artworkToken
      const colors = await getArtworkColors(pic)
      // 期间又换歌/关闭了，丢弃这次结果
      if (token !== artworkToken) return
      if (!colors.length) {
        clearArtworkBackground()
        return
      }
      artworkColors.value = colorsToCss(colors)
    }

    // 主题自带背景图时保留主题背景，不用封面取色覆盖它
    const isThemeHasBackgroundImage = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--background-image')
        .trim()
      return value != '' && value != 'none'
    }

    watch(
      () => [
        isShowPlayerDetail.value,
        musicInfo.pic,
        appSetting['player.artworkColorBackground'],
        appSetting['theme.id'],
      ],
      ([isShow, pic, enabled]) => {
        if (!isShow || !enabled || !pic || isThemeHasBackgroundImage()) {
          clearArtworkBackground()
          return
        }
        void setArtworkBackground(pic)
      },
      { immediate: true }
    )

    return {
      appSetting,
      artworkStyle,
      artworkVeilStyle,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      hide,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isFullscreen,
      fullscreenExit() {
        void setFullScreen(false).then((fullscreen) => {
          isFullscreen.value = fullscreen
        })
      },
      min() {
        minWindow()
      },
      max() {
        maxWindow()
      },
      close() {
        closeWindow()
      },
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * 0.26;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: var(--color-content-background);
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: strict;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}
// 封面取色的动态背景，垫在 .bg 的主题底色遮罩下面。
// 渐变的形状固定，只有色标是可变的，换歌时 Chromium 会按 transition 平滑插值这几个颜色
.artworkBg {
  position: absolute;
  top: -8%;
  left: -8%;
  width: 116%;
  height: 116%;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(120% 120% at 22% 12%, var(--artwork-c0) 0%, transparent 60%),
    radial-gradient(110% 110% at 84% 86%, var(--artwork-c1) 0%, transparent 55%),
    linear-gradient(160deg, var(--artwork-c2) 0%, var(--artwork-c3) 100%);
  transition-property: --artwork-c0, --artwork-c1, --artwork-c2, --artwork-c3;
  transition-duration: 1.6s;
  transition-timing-function: ease-in-out;
  animation: artwork-bg-drift var(--artwork-speed, 30s) ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes artwork-bg-drift {
  from {
    transform: scale(var(--artwork-zoom-from, 1.02)) translate3d(-1.6%, -1.2%, 0);
  }
  to {
    transform: scale(var(--artwork-zoom-to, 1.14)) translate3d(1.8%, 2.2%, 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .artworkBg {
    animation: none;
  }
}

.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  // background-size: 110% 110%;
  // filter: blur(60px);
  opacity: 0.7;
  z-index: -1;
  // 取到封面主色时减弱主题底色遮罩，让主色透出来（数值由 artworkVeilStyle 给出）
  &:before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-app-background);
    opacity: var(--artwork-veil-inner, 1);
  }
  &:after {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-main-background);
    opacity: var(--artwork-veil, 1);
  }
}
// .bg2 {
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   top: 0;
//   left: 0;
//   z-index: -1;
//   background-color: rgba(255, 255, 255, .8);
// }

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  margin: 0 30px;
  position: relative;

  &.showComment {
    :global {
      .left {
        flex-basis: 18%;
        .description p {
          font-size: 12px;
        }
      }
      .right {
        flex-basis: 30%;
        .lyricSelectContent {
          font-size: 14px;
        }
      }
      .comment {
        opacity: 1;
        transform: scaleX(1);
      }
    }
  }
}
.left {
  flex: 0 0 40%;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  padding: 13px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

.info {
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  max-width: 300px;
  min-height: 0;
}
.img {
  max-width: 100%;
  max-height: 80%;
  min-width: 100%;
  box-shadow: 0 0 6px var(--color-primary-alpha-500);
  border-radius: 6px;
  opacity: 0.8;
}
.description {
  max-width: 300px;
  margin-top: 15px;
  padding-bottom: 15px;
  min-height: 0;
  p {
    line-height: 1.5;
    font-size: 14px;
    overflow-wrap: break-word;
  }
}

.comment {
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  opacity: 1;
  margin-left: 10px;
  transform: scaleX(0);
}
</style>
