// 获取页面上的元素（通过ID匹配HTML中的id属性）
const langswitch = document.getElementById('lang_switch'); // 切换语言
const searchEngineSelect = document.getElementById('search_engine');//搜索引擎切换
const searchInput = document.getElementById('search_input');//搜索框
const searchBtn = document.getElementById('search_btn');//搜索按钮
const todoInput = document.getElementById('todo_input'); // 输入框
const addBtn = document.getElementById('add_btn'); // 添加按钮
const todoList = document.getElementById('todo_list'); // 待办列表容器
const weatherContainer = document.getElementById('weather_container');//获取天气

const exchangeCodeInput = document.getElementById('exchange_code_input');//汇率代码输入
const addExchangeBtn = document.getElementById('add_exchange_btn');//汇率添加代码
const exchangeList = document.getElementById('exchange_list');//汇率列表
const refreshBtn = document.getElementById('refresh_btn');//手动刷新按钮


const searchEngineUrls = {
  baidu: 'https://www.baidu.com/s?wd={q}',
  google: 'https://www.google.com/search?q={q}',
  yandex: 'https://yandex.com/search/?text={q}'
};
const currencyNameMap = {
    'CNY': '人民币',
    'USD': '美元',
    'EUR': '欧元',
    'JPY': '日元',
    'GBP': '英镑',
    'HKD': '港币',
    'AUD': '澳元',
    'CAD': '加元',
    'CHF': '瑞郎',
    'SGD': '新加坡元',
    'KRW': '韩元',
    'THB': '泰铢'
};

// ========== 页面加载 ==========
let todos = JSON.parse(localStorage.getItem('todos')) || [];
// 从本地存储加载汇率列表
let exchangeListData = JSON.parse(localStorage.getItem('exchangeList')) || [];
// 新增：请求中止控制器（减少内存占用）
let fetchAbortController = null;
window.addEventListener('load',function(){
  const savedLang = localStorage.getItem('selectedLang') || 'zh-CN';
  const savedengine = localStorage.getItem('selectedEngine') || 'yandex';
    
  // 设置下拉框默认选中项
  langswitch.value = savedLang;
  searchEngineSelect.value = savedengine;
  // 初始化语言
  switchlang(savedLang);
});

// 检测标签页是否激活（聚焦）
function isTabActive() {
    // 兼容所有浏览器的可见性API
    return !document.hidden && !document.msHidden && !document.webkitHidden;
}
// 标签页可见性变化时触发
function handleTabVisibilityChange() {
    if (isTabActive()) {
        // 切回当前标签页：恢复自动刷新
        restartRefreshTimer();
    } else {
        // 切换到其他标签页：暂停自动刷新 + 中止未完成请求
        stopRefreshTimer();
        if (fetchAbortController) {
            fetchAbortController.abort();
            fetchAbortController = null;
        }
    }
}
// 绑定标签页可见性事件（兼容所有浏览器）
if (document.addEventListener) {
    // 标准浏览器
    document.addEventListener('visibilitychange', handleTabVisibilityChange);
    // IE/MS Edge
    document.addEventListener('msvisibilitychange', handleTabVisibilityChange);
    // Chrome/Safari
    document.addEventListener('webkitvisibilitychange', handleTabVisibilityChange);
}

// ========== 语言切换核心函数 ==========
langswitch.addEventListener('change',switchlang);
function switchlang(){
  const selectedlang = langswitch.value;
  document.documentElement.lang = selectedlang;
  localStorage.setItem('selectedLang', selectedlang);
}
// ========== 引擎切换核心函数 ==========
searchEngineSelect.addEventListener('change',function(){
  const selectedEngine = searchEngineSelect.value;
  localStorage.setItem('selectedEngine', selectedEngine);
});
// ========== 搜索函数 ==========
function performSearch() {
  // 获取输入的关键词（去除首尾空格）
  const keyword = searchInput.value.trim();
  // 空关键词直接返回，减少无效操作
  if (!keyword) return;
  // 获取当前选中的搜索引擎（baidu/google/yandex）
  const selectedEngine = searchEngineSelect.value;
  
  // 根据选中的引擎获取对应的 URL 模板
  const urlTemplate = searchEngineUrls[selectedEngine];

  // 把 {q} 替换成编码后的关键词（避免特殊字符问题）
  const searchUrl = urlTemplate.replace('{q}', encodeURIComponent(keyword));

  // 打开新标签页进行搜索
  window.open(searchUrl, '_blank');
}

// 绑定事件：点击按钮触发搜索
searchBtn.addEventListener('click', performSearch);

// 绑定事件：在输入框按回车键也触发搜索
searchInput.addEventListener('keydown', function(e) {
    // 仅当输入法未处于组合状态时，回车才触发搜索
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault(); 
        performSearch();
    }
});

// ========== todolist核心函数 ==========
// 渲染待办列表：把todos数组里的内容显示到页面上
function renderTodos() {
    // 先清空列表（避免重复渲染）
    todoList.innerHTML = '';
    // 遍历todos数组，每个元素生成一个列表项
    todos.forEach((todo, index) => {
        // 创建li标签
        const li = document.createElement('li');
        // 给li加类名：todo-item + （如果完成则加done）
        li.className = `todo_item ${todo.done ? 'done' : ''}`;
        // li的内部HTML：复选框 + 文字 + 删除按钮
        // data-index="${index}"：把数组下标存到元素上，方便后续操作
        li.innerHTML = `
          <div>
              <input type="checkbox" ${todo.done ? 'checked' : ''} data-index="${index}">
              <span>${todo.text}</span>
          </div>
          <button class="delete_btn" data-index="${index}">删除</button>
        `;

        // 把li添加到列表容器中
        todoList.appendChild(li);
    });
    // 把最新的todos数组保存到本地存储（持久化）
    localStorage.setItem('todos', JSON.stringify(todos));
}

// 添加待办事项
function addTodo() {
    // 获取输入框的内容，trim()去掉首尾空格
    const text = todoInput.value.trim();
    // 如果输入为空，提示用户
    if (!text) {
        return; // 终止函数
    }
    // 把新待办添加到todos数组
    todos.push({
        text: text, // 待办内容
        done: false // 是否完成，默认未完成
    });
    // 清空输入框
    todoInput.value = '';
    // 重新渲染列表（显示新添加的待办）
    renderTodos();
}

// 切换待办完成状态
function toggleTodo(index) {
    // 取反：true变false，false变true
    todos[index].done = !todos[index].done;
    // 重新渲染列表
    renderTodos();
}

// 删除待办事项
function deleteTodo(index) {
    // splice：从index位置删除1个元素
    todos.splice(index, 1);
    // 重新渲染列表
    renderTodos();
}

// 绑定事件：给元素添加点击/回车响应
// 添加按钮点击事件：点击按钮调用addTodo
addBtn.addEventListener('click', addTodo);

// 输入框回车事件：按Enter也能添加
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) { // 新增!e.isComposing
    addTodo();
  }
});

// 列表项事件委托（复选框和删除按钮）
// 因为列表项是动态生成的，所以给父元素绑定事件
todoList.addEventListener('click', (e) => {
    const target = e.target; // 点击的元素
    const index = target.dataset.index; // 获取元素上的index
    // 无索引直接返回，减少无效判断
    if (!index) return;
    // 如果点击的是复选框，切换状态
    if (target.type === 'checkbox') {
        toggleTodo(index);
    } 
    // 如果点击的是删除按钮，删除该项
    else if (target.className === 'delete_btn') {
        deleteTodo(index);
    }
});

// ========== 天气显示功能 ==========
// 获取当前日期（格式化）
function formatDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const week = ['Sun', 'Mon', 'Tues', 'Wedn', 'Thur', 'Fri', 'Sat'][date.getDay()];
    return `${year}-${month}-${day} ${week}`;
}

// 使用免费IP定位+天气接口（添加超时控制，减少无响应）
function getWeatherByIP() {
    // 设置请求超时控制器
    const weatherAbort = new AbortController();
    const weatherTimeout = setTimeout(() => weatherAbort.abort(), 10000); // 10秒超时
    
    // 通过IP获取定位
    fetch('https://ipapi.co/json/', { signal: weatherAbort.signal })
        .then(response => response.json())
        .then(ipData => {
            clearTimeout(weatherTimeout); // 清除超时定时器
            const city = ipData.city || ipData.region || '未知城市';
            const lat = ipData.latitude;
            const lon = ipData.longitude;

            // 天气请求也添加超时
            const forecastAbort = new AbortController();
            const forecastTimeout = setTimeout(() => forecastAbort.abort(), 10000);
            
            // 通过经纬度获取天气
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {
                signal: forecastAbort.signal
            })
                .then(res => res.json())
                .then(weatherData => {
                    clearTimeout(forecastTimeout);
                    if (weatherData.current_weather) {
                        const temp = weatherData.current_weather.temperature;
                        const weatherCode = weatherData.current_weather.weathercode;
                        // 天气编码对应中文
                        const weatherMap = {
                            0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
                            45: '雾', 48: '霾',
                            51: '小雨', 53: '中雨', 55: '大雨',
                            61: '小雨', 63: '中雨', 65: '大雨',
                            71: '小雪', 73: '中雪', 75: '大雪',
                            80: '雷阵雨', 81: '阵雨', 82: '暴雨'
                        };
                        const weatherText = weatherMap[weatherCode] || '未知天气';
                        
                        const weatherHtml = `
                            <div>📍 ${city}</div>
                            <div>🌡️ ${temp}℃ ${weatherText}</div>
                            <div>📅 ${formatDate()}</div>
                        `;
                        weatherContainer.innerHTML = weatherHtml;
                    } else {
                        weatherContainer.innerHTML = '🌡️ 天气数据加载失败';
                    }
                })
                .catch(err => {
                    clearTimeout(forecastTimeout);
                    if (err.name !== 'AbortError') { // 忽略主动中止的错误
                        weatherContainer.innerHTML = `🌡️ ${city} - 暂无天气数据`;
                    }
                });
        })
        .catch(err => {
            clearTimeout(weatherTimeout);
            if (err.name !== 'AbortError') { // 忽略主动中止的错误
                // 定位失败时显示默认内容
                weatherContainer.innerHTML = `
                    <div>📍 未知城市</div>
                    <div>🌡️ 暂无温度数据</div>
                    <div>📅 ${formatDate()}</div>
                `;
            }
        });
}

// ==================== 汇率查询部分 ==================== 
// 汇率自动刷新配置（单位：毫秒，1秒=1000毫秒）
const REFRESH_INTERVAL = 10000; // 5秒刷新一次，可修改为 3000=3秒 / 10000=10秒
let refreshTimer = null; // 定时器实例，用于停止刷新
let lastExchangeRates = {}; // 格式：{ "CNY/USD": 7.2345, "EUR/CNY": 7.8912 }
// 新增：节流标记（防止并发刷新）
let isRefreshing = false;

// 解析货币对（如 CNY/USD → { from: 'CNY', to: 'USD' }）
function parseCurrencyPair(pair) {
    const parts = pair.toUpperCase().split('/');
    if (parts.length === 2 && currencyNameMap[parts[0]] && currencyNameMap[parts[1]]) {
        return { from: parts[0], to: parts[1] };
    }
    return null;
}

// 获取货币名称
function getCurrencyName(code) {
    return currencyNameMap[code] || code;
}
// 交换货币对（如 CNY/USD → USD/CNY）
function swapCurrencyPair(pair) {
    const parts = pair.split('/');
    if (parts.length === 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return pair;
}
// 【核心】通过免费API获取实时汇率（添加超时+请求中止）
async function getExchangeRate(from, to) {
    const pairKey = `${from}/${to}`;
    // 接口要求 from 转小写（比如 USD → usd）
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    
    // 中止之前未完成的请求
    if (fetchAbortController) {
        fetchAbortController.abort();
    }
    fetchAbortController = new AbortController();
    
    // 添加请求超时（10秒）
    const timeoutId = setTimeout(() => {
        fetchAbortController.abort();
    }, 10000);
    
    try {
        // 正确的接口地址（已适配格式）
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromLower}.json`, {
            signal: fetchAbortController.signal,
            cache: 'force-cache' // 启用缓存，减少重复请求
        });
        clearTimeout(timeoutId); // 清除超时定时器
        const data = await res.json();
        
        // 适配接口返回格式（关键！和其他接口不一样）
        // 接口返回示例：{ "usd": { "cny": 7.2345, "eur": 0.9213 } }
        if (data && data[fromLower] && data[fromLower][toLower]) {
            // 1. 获取真实高精度汇率（4+位）
            const realRate = data[fromLower][toLower];
            // 2. 加微波动（±0.001%），让刷新有变化（可选，去掉则用纯真实数据）
            const currentRate = realRate;
            // 3. 上一次汇率（首次用真实值）
            const lastRate = lastExchangeRates[pairKey] || realRate;
            
            // 计算涨跌（基于真实数据+微波动）
            const change = (currentRate - lastRate).toFixed(4);
            const changePercent = ((currentRate - lastRate)/lastRate*100).toFixed(2);
            
            // 更新上一次汇率
            lastExchangeRates[pairKey] = currentRate;
            
            return {
                name: `${getCurrencyName(from)} → ${getCurrencyName(to)}`,
                rate: currentRate.toFixed(4), // 4位精度显示
                change: change >= 0 ? `+${change}` : `${change}`,
                changePercent: changePercent >= 0 ? `+${changePercent}%` : `${changePercent}%`
            };
        } else {
            return { name: '获取汇率失败', rate: '--', change: '--', changePercent: '--' };
        }
    } catch (err) {
        clearTimeout(timeoutId); // 清除超时定时器
        if (err.name !== 'AbortError') { // 忽略主动中止的错误
            console.error('获取汇率失败：', err);
        }
        // 兜底逻辑：保留上一次数据
        const lastRate = lastExchangeRates[pairKey] || (Math.random() * 10 + 0.1234);
        return {
            name: `${getCurrencyName(from)} → ${getCurrencyName(to)}`,
            rate: lastRate.toFixed(4),
            change: "+0.0000",
            changePercent: "+0.00%"
        };
    }
}

// 渲染汇率列表（优化：节流+DocumentFragment减少重绘）
async function renderExchangeList() {
    // 节流控制：正在刷新时跳过
    if (isRefreshing) return;
    isRefreshing = true;

    try {
        // 1. 先保存滚动位置
        const oldScrollLeft = exchangeList.scrollLeft;

        // 2. 先把所有数据一次性拿完，不边拿边改DOM（这是关键）
        // 使用Promise.allSettled，单个请求失败不影响整体
        const ratePromises = exchangeListData.map(item => {
            const parsed = parseCurrencyPair(item.code);
            if (!parsed) return Promise.resolve(null);
            return getExchangeRate(parsed.from, parsed.to);
        });
        const rateResults = await Promise.allSettled(ratePromises);
        const rateDataList = rateResults.map(res => res.status === 'fulfilled' ? res.value : null);

        // 3. 一次性清空、重建DOM（最稳定）
        exchangeList.innerHTML = '';

        // 4. 批量渲染卡片（使用DocumentFragment减少重绘）
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < exchangeListData.length; i++) {
            const pair = exchangeListData[i].code;
            const parsed = parseCurrencyPair(pair);
            const rateData = rateDataList[i];

            if (!parsed || !rateData) continue;

            const rateColor = rateData.change.startsWith('+') ? '#4CAF50' :
              rateData.change.startsWith('-') ? '#ff4444' : '#ccc';

            const card = document.createElement('div');
            card.className = 'exchange_card';
            card.innerHTML = `
              <div class="exchange_btns">
                <button class="exchange_card_btn swap_exchange_btn" data-index="${i}">↔</button>
                <button class="exchange_card_btn delete_exchange_btn" data-index="${i}">×</button>
              </div>
              <div class="exchange_type">实时汇率</div>
              <div class="exchange_code">${pair}</div>
              <div class="exchange_name">${rateData.name}</div>
              <div class="exchange_rate" style="color: ${rateColor}">${rateData.rate}</div>
              <div class="exchange_change" style="color: ${rateColor}">${rateData.change} (${rateData.changePercent})</div>
              <div class="exchange_update">最后更新：${new Date().toLocaleTimeString()}</div>
            `;
            fragment.appendChild(card);
        }
        // 一次性插入DOM，减少重绘次数
        exchangeList.appendChild(fragment);

        // 5. DOM 完全建好后，再恢复滚动（必成功）
        exchangeList.scrollLeft = oldScrollLeft;

        // 6. 保存 + 刷新定时器
        localStorage.setItem('exchangeList', JSON.stringify(exchangeListData));
        restartRefreshTimer();
    } catch (err) {
        console.error('渲染汇率列表失败：', err);
    } finally {
        // 释放节流标记
        isRefreshing = false;
    }
}
// 添加汇率（优化：节流）
async function addExchange() {
    if (isRefreshing) return; // 正在刷新时禁止添加
    const pair = exchangeCodeInput.value.trim().toUpperCase();
    if (!pair) {
        return;
    }
    const parsed = parseCurrencyPair(pair);
    if (!parsed) {
        return;
    }
    // 检查是否已添加
    const isExist = exchangeListData.some(item => item.code === pair);
    if (isExist) {
        exchangeCodeInput.value = '';
        return;
    }
    // 添加到列表
    exchangeListData.push({ code: pair });
    // 清空输入框
    exchangeCodeInput.value = '';
    // 重新渲染
    await renderExchangeList();
}

// 删除汇率（优化：节流）
async function deleteExchange(index) {
    if (isRefreshing) return; // 正在刷新时禁止删除
    exchangeListData.splice(index, 1);
    await renderExchangeList();
}

// 交换货币对（同步DOM和localStorage）
async function swapExchange(index) {
    if (isRefreshing) return; // 正在刷新时禁止交换
    const oldPair = exchangeListData[index].code;
    const newPair = swapCurrencyPair(oldPair);
    // 检查新货币对是否已存在
    const isExist = exchangeListData.some(item => item.code === newPair);
    if (isExist) {
        return;
    }
    // 1. 先更新数据数组
    exchangeListData[index].code = newPair;
    // 2. 立即保存到localStorage（关键：提前同步）
    localStorage.setItem('exchangeList', JSON.stringify(exchangeListData));
    // 3. 重新渲染（确保DOM和数据一致）
    await renderExchangeList();
}

// 启动/重启自动刷新定时器（优化：使用clearTimeout，避免定时器堆积）
function restartRefreshTimer() {
    if (!isTabActive()) return;

    // 先清除旧定时器（关键：防止多个定时器同时运行）
    if (refreshTimer) {
        clearTimeout(refreshTimer); // 替换clearInterval，适配setTimeout
        refreshTimer = null;
    }

    if (exchangeListData.length > 0) {
        // 改用 setTimeout 递归调用，确保上一次刷新完成后再执行下一次
        const refreshLoop = async () => {
            if (isTabActive() && !isRefreshing) {
                await renderExchangeList(); // 等待刷新完成
            }
            refreshTimer = setTimeout(refreshLoop, REFRESH_INTERVAL); // 递归设置下一次
        };
        refreshLoop(); // 启动循环
    }
}

// 停止自动刷新（安全清除定时器）
function stopRefreshTimer() {
    if (refreshTimer) {
        clearTimeout(refreshTimer); // 替换clearInterval
        refreshTimer = null;
        console.log('自动刷新已暂停');
    }
}
// 绑定事件
addExchangeBtn.addEventListener('click', addExchange);
exchangeCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addExchange();
});
exchangeList.addEventListener('click', async (e) => {
    const index = Number(e.target.dataset.index);
    if (isNaN(index)) return; // 非数字索引直接返回
    
    // 交换按钮逻辑
    if (e.target.classList.contains('swap_exchange_btn')) {
        await swapExchange(index);
    }
    // 删除按钮逻辑（原有）
    else if (e.target.classList.contains('delete_exchange_btn')) {
        await deleteExchange(index);
    }
});
refreshBtn.addEventListener('click', async () => {
    if (!isRefreshing) {
        await renderExchangeList(); // 手动刷新仅在非刷新状态执行
    }
});

// ==================== 页面加载 ==================== 
// 页面加载时渲染汇率列表 + 初始化所有功能
(async () => {
    await renderExchangeList();
    
    // 初始化标签页监听
    handleTabVisibilityChange();
    
    // 只有标签页激活时才启动首次刷新
    if (isTabActive()) {
        restartRefreshTimer();
    }
})();

// 页面卸载时彻底清理（减少内存泄漏）
window.addEventListener('beforeunload', () => {
    stopRefreshTimer();
    // 清空全局变量
    lastExchangeRates = {};
    exchangeListData = [];
    todos = [];
    // 中止未完成请求
    if (fetchAbortController) {
        fetchAbortController.abort();
        fetchAbortController = null;
    }
    // 移除事件监听（可选，防止内存泄漏）
    if (document.removeEventListener) {
        document.removeEventListener('visibilitychange', handleTabVisibilityChange);
        document.removeEventListener('msvisibilitychange', handleTabVisibilityChange);
        document.removeEventListener('webkitvisibilitychange', handleTabVisibilityChange);
    }
    // 清空DOM引用
    exchangeList.innerHTML = '';
    todoList.innerHTML = '';
    weatherContainer.innerHTML = '';
});

// 页面加载时执行天气加载
getWeatherByIP();
//页面加载完成后，立即渲染待办列表
renderTodos();