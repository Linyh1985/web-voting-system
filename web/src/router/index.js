import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { path: '/register', name: 'Register', component: () => import('../views/Register.vue') },
  { path: '/vote/:id', name: 'VoteDetail', component: () => import('../views/VoteDetail.vue') },
  { path: '/vote/:id/stats', name: 'VoteStats', component: () => import('../views/VoteStats.vue') },
  { path: '/create', name: 'VoteCreate', component: () => import('../views/VoteCreate.vue'), meta: { requiresAuth: true } },
  { path: '/edit/:id', name: 'VoteEdit', component: () => import('../views/VoteCreate.vue'), meta: { requiresAuth: true } },
  { path: '/user', name: 'UserCenter', component: () => import('../views/UserCenter.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'Admin', component: () => import('../views/Admin.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('../views/NotFound.vue') }
];

const router = createRouter({ history: createWebHistory(), routes, scrollBehavior: () => ({ top: 0 }) });

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (to.meta.requiresAuth && !token) return next('/login');
  if (to.meta.requiresAdmin && user?.role !== 1) return next('/');
  next();
});

export default router;
