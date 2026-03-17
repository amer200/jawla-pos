import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          // هنا بنعرف كل شاشة بملف الـ HTML بتاعها
          // تأكد إن المسارات دي مطابقة لمكان الملفات عندك في src/renderer
          login: resolve(__dirname, 'src/renderer/login.html'),
          index: resolve(__dirname, 'src/renderer/index.html'),
          cashier: resolve(__dirname, 'src/renderer/cashier.html')
        }
      }
    }
  }
})