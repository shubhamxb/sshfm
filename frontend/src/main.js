import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'

const savedTheme = localStorage.getItem('sshfm_theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

createApp(App).mount('#app')
