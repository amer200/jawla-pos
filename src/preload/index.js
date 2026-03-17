import { contextBridge, ipcRenderer } from 'electron'

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', {
            // تسجيل الدخول 
            login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
            // --- الفواتير والعهدة ---
            getMyRecentSales: () => ipcRenderer.invoke('get-my-recent-sales'), // الفاصلة دي كانت ناقصة

            // --- المخزن والأقسام ---
            addCategory: (name) => ipcRenderer.invoke('add-category', name),
            getCategories: () => ipcRenderer.invoke('get-categories'),
            addProduct: (product) => ipcRenderer.invoke('add-product', product),
            getAllProducts: () => ipcRenderer.invoke('get-all-products'),
            updateProduct: (product) => ipcRenderer.invoke('update-product', product),
            deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),

            // --- الكاشير والبحث ---
            searchProductsSuggestions: (query) => ipcRenderer.invoke('search-products-suggestions', query),
            completeSale: (saleData) => ipcRenderer.invoke('complete-sale', saleData),

            // --- الموظفين والعهدة ---
            addUser: (user) => ipcRenderer.invoke('add-user', user),
            getEmployeesBalances: () => ipcRenderer.invoke('get-employees-balances'),
            settleUserSales: (id) => ipcRenderer.invoke('settle-user-sales', id),

            // --- الطباعة ---
            printReceipt: (html) => ipcRenderer.send('print-receipt', html)
        })
    } catch (error) {
        console.error("❌ Preload Error:", error)
    }
}