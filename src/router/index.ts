import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'discover',
      component: () => import('@/views/DiscoverView.vue'),
      meta: { title: '发现音乐' }
    },
    {
      path: '/playlist',
      name: 'playlist',
      component: () => import('@/views/PlaylistView.vue'),
      meta: { title: '播放列表' }
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: () => import('@/views/FavoritesView.vue'),
      meta: { title: '我的收藏' }
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue'),
      meta: { title: '播放历史' }
    },
    {
      path: '/folder/:id',
      name: 'folder-detail',
      component: () => import('@/views/FolderDetailView.vue'),
      props: true,
      meta: { title: '歌单详情' }
    },
    {
      path: '/add-url',
      name: 'add-url',
      component: () => import('@/views/AddUrlView.vue'),
      meta: { title: '添加音乐' }
    },
    {
      path: '/rankings',
      name: 'rankings',
      component: () => import('@/views/RankingsView.vue'),
      meta: { title: '排行榜' }
    },
    {
      path: '/source',
      name: 'source',
      component: () => import('@/views/SourceView.vue'),
      meta: { title: '音源管理' }
    },
    {
      path: '/now-playing',
      name: 'now-playing',
      component: () => import('@/views/NowPlayingView.vue'),
      meta: { title: '正在播放' }
    }
  ]
})

router.beforeEach((to) => {
  const title = (to.meta.title as string) || 'AudioFlow'
  document.title = `${title} - AudioFlow Player`
})

export default router
