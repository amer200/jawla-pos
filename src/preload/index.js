import { contextBridge, ipcRenderer } from 'electron'

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('api', {
            // --- المصادقة والتحكم بالنافذة ---
            login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
            closeApp: () => ipcRenderer.send('app:close'),

            // --- المخزن والأقسام ---
            getCategories: () => ipcRenderer.invoke('get-categories'),
            addCategory: (name) => ipcRenderer.invoke('add-category', name),
            getAllProducts: () => ipcRenderer.invoke('get-all-products'),
            addProduct: (product) => ipcRenderer.invoke('add-product', product),
            updateProduct: (product) => ipcRenderer.invoke('update-product', product),
            deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),

            // --- الكاشير والمبيعات ---
            searchProductsSuggestions: (query) => ipcRenderer.invoke('search-products-suggestions', query),
            completeSale: (saleData) => ipcRenderer.invoke('complete-sale', saleData),
            getMyRecentSales: () => ipcRenderer.invoke('get-my-recent-sales'),

            // --- الموظفين والعهد ---
            addUser: (user) => ipcRenderer.invoke('add-user', user),
            getEmployeesBalances: () => ipcRenderer.invoke('get-employees-balances'),
            settleUserSales: (id) => ipcRenderer.invoke('settle-user-sales', id),

            // --- إعدادات المتجر العامة ---
            getSettings: () => ipcRenderer.invoke('get-settings'),
            updateSetting: (data) => ipcRenderer.invoke('update-setting', data),

            // --- الطباعة ---
            printReceipt: (html) => ipcRenderer.send('print-receipt', html),
            getPrinters: () => ipcRenderer.invoke('get-printers'),
            printReceipt: (payload) => ipcRenderer.send('print-receipt', payload),
        })
    } catch (error) {
        console.error("❌ Preload Bridge Error:", error)
    }
}