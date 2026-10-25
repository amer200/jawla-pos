"use strict";
const electron = require("electron");
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("api", {
      // --- المصادقة والتحكم بالنافذة ---
      login: (credentials) => electron.ipcRenderer.invoke("auth:login", credentials),
      closeApp: () => electron.ipcRenderer.send("app:close"),
      // --- المخزن والأقسام ---
      getCategories: () => electron.ipcRenderer.invoke("get-categories"),
      addCategory: (name) => electron.ipcRenderer.invoke("add-category", name),
      getAllProducts: () => electron.ipcRenderer.invoke("get-all-products"),
      addProduct: (product) => electron.ipcRenderer.invoke("add-product", product),
      updateProduct: (product) => electron.ipcRenderer.invoke("update-product", product),
      deleteProduct: (id) => electron.ipcRenderer.invoke("delete-product", id),
      // --- الكاشير والمبيعات ---
      searchProductsSuggestions: (query) => electron.ipcRenderer.invoke("search-products-suggestions", query),
      completeSale: (saleData) => electron.ipcRenderer.invoke("complete-sale", saleData),
      getMyRecentSales: () => electron.ipcRenderer.invoke("get-my-recent-sales"),
      // --- الموظفين والعهد ---
      addUser: (user) => electron.ipcRenderer.invoke("add-user", user),
      getEmployeesBalances: () => electron.ipcRenderer.invoke("get-employees-balances"),
      settleUserSales: (id) => electron.ipcRenderer.invoke("settle-user-sales", id),
      // --- إعدادات المتجر العامة ---
      getSettings: () => electron.ipcRenderer.invoke("get-settings"),
      updateSetting: (data) => electron.ipcRenderer.invoke("update-setting", data),
      // --- الطباعة ---
      printReceipt: (html) => electron.ipcRenderer.send("print-receipt", html),
      getPrinters: () => electron.ipcRenderer.invoke("get-printers"),
      printReceipt: (payload) => electron.ipcRenderer.send("print-receipt", payload)
    });
  } catch (error) {
    console.error("❌ Preload Bridge Error:", error);
  }
}
