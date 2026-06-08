export const THEME_STORAGE_KEY = "riseup-theme";

export const THEME_INIT_SCRIPT = `!function(){try{var e=document.documentElement,t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";"system"===t&&(t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),e.classList.remove("light","dark"),e.classList.add(t),e.style.colorScheme=t}catch(e){}}();`;
