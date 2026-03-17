"use strict";
const electron = require("electron");
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("api", {
      // تسجيل الدخول 
      login: (credentials) => electron.ipcRenderer.invoke("auth:login", credentials),
      // --- الفواتير والعهدة ---
      getMyRecentSales: () => electron.ipcRenderer.invoke("get-my-recent-sales"),
      // الفاصلة دي كانت ناقصة
      // --- المخزن والأقسام ---
      addCategory: (name) => electron.ipcRenderer.invoke("add-category", name),
      getCategories: () => electron.ipcRenderer.invoke("get-categories"),
      addProduct: (product) => electron.ipcRenderer.invoke("add-product", product),
      getAllProducts: () => electron.ipcRenderer.invoke("get-all-products"),
      updateProduct: (product) => electron.ipcRenderer.invoke("update-product", product),
      deleteProduct: (id) => electron.ipcRenderer.invoke("delete-product", id),
      // --- الكاشير والبحث ---
      searchProductsSuggestions: (query) => electron.ipcRenderer.invoke("search-products-suggestions", query),
      completeSale: (saleData) => electron.ipcRenderer.invoke("complete-sale", saleData),
      // --- الموظفين والعهدة ---
      addUser: (user) => electron.ipcRenderer.invoke("add-user", user),
      getEmployeesBalances: () => electron.ipcRenderer.invoke("get-employees-balances"),
      settleUserSales: (id) => electron.ipcRenderer.invoke("settle-user-sales", id),
      // --- الطباعة ---
      printReceipt: (html) => electron.ipcRenderer.send("print-receipt", html)
    });
  } catch (error) {
    console.error("❌ Preload Error:", error);
  }
}
