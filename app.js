// ========== 常量定义（统一收敛） ==========
// 语言/搜索/天气/汇率 常量集中定义，避免分散
const ELEMENTS = {
    // 语言切换
    langSwitch: document.getElementById('lang_switch'),
    // 搜索
    searchEngineSelect: document.getElementById('search_engine'),
    searchInput: document.getElementById('search_input'),
    searchBtn: document.getElementById('search_btn'),
    // 待办
    todoInput: document.getElementById('todo_input'),
    addBtn: document.getElementById('add_btn'),
    todoList: document.getElementById('todo_list'),
    // 天气
    weatherContainer: document.getElementById('weather_container'),
    // 汇率
    exchangeCodeInput: document.getElementById('exchange_code_input'),
    addExchangeBtn: document.getElementById('add_exchange_btn'),
    exchangeList: document.getElementById('exchange_list'),
    refreshBtn: document.getElementById('refresh_btn')
};

const CONFIG = {
    WEATHER_REFRESH_INTERVAL: 1800000, // 30分钟
    EXCHANGE_REFRESH_BASE: 60000, // 基础刷新间隔
    FETCH_TIMEOUT: 10000, // 统一请求超时时间
    searchEngineUrls: {
        baidu: 'https://www.baidu.com/s?wd={q}',
        google: 'https://www.google.com/search?q={q}',
        yandex: 'https://yandex.com/search/?text={q}'
    },
    currencyNameMap: {
        'CNY': '人民币', 'USD': '美元', 'EUR': '欧元', 'JPY': '日元',
        'GBP': '英镑', 'HKD': '港币', 'AUD': '澳元', 'CAD': '加元',
        'CHF': '瑞郎', 'SGD': '新加坡元', 'KRW': '韩元', 'THB': '泰铢'
    },
    weatherMap: {
        0: '晴', 1: '晴间多云', 2: '多云', 3: '阴',
        45: '雾', 48: '霾', 51: '小雨', 53: '中雨', 55: '大雨',
        61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪',
        75: '大雪', 80: '雷阵雨', 81: '阵雨', 82: '暴雨'
    }
};

// ========== 全局状态（统一管理） ==========
let state = {
    todos: JSON.parse(localStorage.getItem('todos')) || [],
    exchangeListData: JSON.parse(localStorage.getItem('exchangeList')) || [],
    lastExchangeRates: JSON.parse(localStorage.getItem('lastExchangeRates')) || {},
    fetchAbortController: null,
    weatherRefreshTimer: null,
    exchangeRefreshTimer: null,
    isWeatherRefreshing: false,
    isExchangeRefreshing: false,
    exchangeRefreshInterval: CONFIG.EXCHANGE_REFRESH_BASE
};

// ========== 工具函数（通用能力抽离） ==========
// 检测标签页是否激活（通用方法）
function isTabActive() {
    return !document.hidden && !document.msHidden && !document.webkitHidden;
}

// 解析货币对（通用方法）
function parseCurrencyPair(pair) {
    const parts = pair.toUpperCase().split('/');
    if (parts.length === 2 && CONFIG.currencyNameMap[parts[0]] && CONFIG.currencyNameMap[parts[1]]) {
        return { from: parts[0], to: parts[1] };
    }
    return null;
}

// 获取货币名称（通用方法）
function getCurrencyName(code) {
    return CONFIG.currencyNameMap[code] || code;
}

// 交换货币对（通用方法）
function swapCurrencyPair(pair) {
    const parts = pair.split('/');
    return parts.length === 2 ? `${parts[1]}/${parts[0]}` : pair;
}

// ========== 标签页可见性管理（统一处理） ==========
function handleTabVisibilityChange() {
    if (isTabActive()) {
        restartWeatherRefreshTimer();
        restartExchangeRefreshTimer();
    } else {
        stopWeatherRefreshTimer();
        stopExchangeRefreshTimer();
        // 中止未完成请求
        if (state.fetchAbortController) {
            state.fetchAbortController.abort();
            state.fetchAbortController = null;
        }
    }
}

// 绑定标签页事件（仅一次）
['visibilitychange', 'msvisibilitychange', 'webkitvisibilitychange'].forEach(event => {
    document.addEventListener(event, handleTabVisibilityChange);
});

// ========== 语言/搜索功能 ==========
// 初始化语言/搜索引擎
function initLangAndSearch() {
    const savedLang = localStorage.getItem('selectedLang') || 'zh-CN';
    const savedEngine = localStorage.getItem('selectedEngine') || 'yandex';
    ELEMENTS.langSwitch.value = savedLang;
    ELEMENTS.searchEngineSelect.value = savedEngine;
    document.documentElement.lang = savedLang;
}

// 语言切换
ELEMENTS.langSwitch.addEventListener('change', () => {
    const selectedLang = ELEMENTS.langSwitch.value;
    document.documentElement.lang = selectedLang;
    localStorage.setItem('selectedLang', selectedLang);
});

// 搜索引擎切换
ELEMENTS.searchEngineSelect.addEventListener('change', () => {
    localStorage.setItem('selectedEngine', ELEMENTS.searchEngineSelect.value);
});

// 执行搜索
function performSearch() {
    const keyword = ELEMENTS.searchInput.value.trim();
    if (!keyword) return;
    const selectedEngine = ELEMENTS.searchEngineSelect.value;
    const searchUrl = CONFIG.searchEngineUrls[selectedEngine].replace('{q}', encodeURIComponent(keyword));
    window.open(searchUrl, '_blank');
}

// 绑定搜索事件
ELEMENTS.searchBtn.addEventListener('click', performSearch);
ELEMENTS.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        performSearch();
    }
});

// ========== 待办事项功能 ==========
function renderTodos() {
    ELEMENTS.todoList.innerHTML = '';
    state.todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo_item ${todo.done ? 'done' : ''}`;
        li.innerHTML = `
            <div>
                <input type="checkbox" ${todo.done ? 'checked' : ''} data-index="${index}">
                <span>${todo.text}</span>
            </div>
            <button class="delete_btn" data-index="${index}">删除</button>
        `;
        ELEMENTS.todoList.appendChild(li);
    });
    localStorage.setItem('todos', JSON.stringify(state.todos));
}

function addTodo() {
    const text = ELEMENTS.todoInput.value.trim();
    if (!text) return;
    state.todos.push({ text, done: false });
    ELEMENTS.todoInput.value = '';
    renderTodos();
}

function toggleTodo(index) {
    state.todos[index].done = !state.todos[index].done;
    renderTodos();
}

function deleteTodo(index) {
    state.todos.splice(index, 1);
    renderTodos();
}

// 绑定待办事件
ELEMENTS.addBtn.addEventListener('click', addTodo);
ELEMENTS.todoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) addTodo();
});
ELEMENTS.todoList.addEventListener('click', (e) => {
    const target = e.target;
    const index = target.dataset.index;
    if (!index) return;
    if (target.type === 'checkbox') toggleTodo(index);
    else if (target.className === 'delete_btn') deleteTodo(index);
});

// ========== 天气功能 ==========
function getWeatherByIP() {
    if (state.isWeatherRefreshing) return;
    state.isWeatherRefreshing = true;

    const weatherAbort = new AbortController();
    const weatherTimeout = setTimeout(() => weatherAbort.abort(), CONFIG.FETCH_TIMEOUT);

    fetch('https://ipapi.co/json/', { signal: weatherAbort.signal })
        .then(response => response.json())
        .then(ipData => {
            clearTimeout(weatherTimeout);
            const city = ipData.city || ipData.region || '未知城市';
            const lat = ipData.latitude;
            const lon = ipData.longitude;

            const forecastAbort = new AbortController();
            const forecastTimeout = setTimeout(() => forecastAbort.abort(), CONFIG.FETCH_TIMEOUT);

            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`, {
                signal: forecastAbort.signal
            })
                .then(res => res.json())
                .then(weatherData => {
                    clearTimeout(forecastTimeout);
                    if (weatherData.current_weather) {
                        const temp = weatherData.current_weather.temperature;
                        const weatherCode = weatherData.current_weather.weathercode;
                        const weatherText = CONFIG.weatherMap[weatherCode] || '未知天气';
                        const updateTime = new Date().toLocaleTimeString();
                        const dateText = new Date().toLocaleDateString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long'
                        });

                        ELEMENTS.weatherContainer.innerHTML = `
                            <div>📍 ${city}</div>
                            <div>🌡️ ${temp}℃ ${weatherText}</div>
                            <div>📅 ${dateText}</div>
                            <div style="font-size:10px; color:#999;">更新于: ${updateTime}</div>
                        `;
                    } else {
                        ELEMENTS.weatherContainer.innerHTML = '🌡️ 天气数据加载失败';
                    }
                    state.isWeatherRefreshing = false; // 移除此处，放到catch后
                })
                .catch(() => {
                    clearTimeout(forecastTimeout);
                    ELEMENTS.weatherContainer.innerHTML = `🌡️ ${city} - 暂无天气数据`;
                    state.isWeatherRefreshing = false; // 修复：手动重置节流标记
                });
        })
        .catch(() => {
            clearTimeout(weatherTimeout);
            ELEMENTS.weatherContainer.innerHTML = `
                <div>📍 未知城市</div>
                <div>🌡️ 暂无温度数据</div>
                <div>📅 ${new Date().toLocaleDateString('zh-CN', { weekday: 'long' })}</div>
            `;
            state.isWeatherRefreshing = false; // 修复：手动重置节流标记
        });
}

function restartWeatherRefreshTimer() {
    stopWeatherRefreshTimer();
    if (isTabActive()) {
        state.weatherRefreshTimer = setTimeout(() => {
            getWeatherByIP();
            restartWeatherRefreshTimer();
        }, CONFIG.WEATHER_REFRESH_INTERVAL); // 确认使用CONFIG中的常量
    }
}

function stopWeatherRefreshTimer() {
    if (state.weatherRefreshTimer) {
        clearTimeout(state.weatherRefreshTimer);
        state.weatherRefreshTimer = null;
    }
}

// ========== 汇率功能 ==========
async function getExchangeRate(from, to) {
    const pairKey = `${from}/${to}`;
    // 中止上一次请求
    if (state.fetchAbortController) {
        state.fetchAbortController.abort();
    }
    state.fetchAbortController = new AbortController();

    try {
        const response = await fetch(
            `https://open.er-api.com/v6/latest/${from}`,
            {
                signal: state.fetchAbortController.signal,
                headers: { 'Accept': 'application/json' }
            }
        );

        if (!response.ok) throw new Error(`接口错误：${response.status}`);
        const data = await response.json();
        if (data.result !== "success" || !data.rates[to]) throw new Error(`无${to}汇率数据`);

        // 计算涨跌（核心修复：首次加载时lastRate=currentRate，涨跌为0，而非不显示）
        const currentRate = data.rates[to];
        const lastRate = state.lastExchangeRates[pairKey] || currentRate; // ✅ 首次无值时用当前值
        const change = (currentRate - lastRate).toFixed(4);
        const changePercent = lastRate !== 0 
            ? ((currentRate - lastRate) / lastRate * 100).toFixed(2) 
            : '0.00';

        // 更新缓存（核心修复：首次加载也写入缓存，确保下次能计算涨跌）
        state.lastExchangeRates[pairKey] = currentRate;
        localStorage.setItem('lastExchangeRates', JSON.stringify(state.lastExchangeRates));

        // 同步接口推荐的刷新间隔
        const nextUpdate = data.time_next_update_unix - Date.now()/1000;
        state.exchangeRefreshInterval = Math.max(300000, nextUpdate * 1000); // 保底5分钟

        // 修复：百分比格式统一（带+/-符号，且补全括号）
        const changeText = change >= 0 ? `+${change}` : change;
        const percentText = changePercent >= 0 
            ? `(+${changePercent}%)` 
            : `(${changePercent}%)`;

        return {
            name: `${getCurrencyName(from)} → ${getCurrencyName(to)}`,
            rate: currentRate.toFixed(4),
            change: changeText, // 涨跌值（如 +0.0023）
            changePercent: percentText // 百分比（如 (+0.03%)）
        };
        } catch (err) {
    // 忽略主动中止的请求，但返回兜底数据，保证卡片能渲染
    if (err.name === 'AbortError') {
        const lastRate = state.lastExchangeRates[pairKey];
        return {
            name: `${getCurrencyName(from)} → ${getCurrencyName(to)}`,
            rate: lastRate ? lastRate.toFixed(4) : '0.0000',
            change: "+0.0000",
            changePercent: "(+0.00%)"
        };
    }
    console.error(`获取${from}/${to}汇率失败：`, err);
    // 其他错误也返回同样的兜底数据
    const lastRate = state.lastExchangeRates[pairKey];
    return {
        name: `${getCurrencyName(from)} → ${getCurrencyName(to)}`,
        rate: lastRate ? lastRate.toFixed(4) : '0.0000',
        change: "+0.0000",
        changePercent: "(+0.00%)"
    };
}
}

async function renderExchangeList() {
    if (state.isExchangeRefreshing) return;
    state.isExchangeRefreshing = true;

    try {
        const oldScrollLeft = ELEMENTS.exchangeList.scrollLeft;
        // 批量请求汇率数据
        const ratePromises = state.exchangeListData.map(item => {
            const parsed = parseCurrencyPair(item.code);
            return parsed ? getExchangeRate(parsed.from, parsed.to) : Promise.resolve(null);
        });
        const rateResults = await Promise.allSettled(ratePromises);
        const rateDataList = rateResults.map(res => res.status === 'fulfilled' ? res.value : null);

        // 批量渲染DOM
        ELEMENTS.exchangeList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        state.exchangeListData.forEach((item, index) => {
            const parsed = parseCurrencyPair(item.code);
            const rateData = rateDataList[index];
            if (!parsed || !rateData) return;

            // 修复：颜色判断兼容首次加载（change为+0.0000时显示默认色）
            const rateColor = rateData.change.startsWith('+') ? '#4CAF50' :
                rateData.change.startsWith('-') ? '#ff4444' : '#ccc';

            const card = document.createElement('div');
            card.className = 'exchange_card';
            card.innerHTML = `
                <div class="exchange_btns">
                    <button class="exchange_card_btn swap_exchange_btn" data-index="${index}">↔</button>
                    <button class="exchange_card_btn delete_exchange_btn" data-index="${index}">×</button>
                </div>
                <div class="exchange_type">实时汇率</div>
                <div class="exchange_code">${item.code}</div>
                <div class="exchange_name">${rateData.name}</div>
                <div class="exchange_rate" style="color: ${rateColor}">${rateData.rate}</div>
                <div class="exchange_change" style="color: ${rateColor}">${rateData.change} ${rateData.changePercent}</div>
                <div class="exchange_update">最后更新：${new Date().toLocaleTimeString()}</div>
            `;
            fragment.appendChild(card);
        });
        ELEMENTS.exchangeList.appendChild(fragment);
        ELEMENTS.exchangeList.scrollLeft = oldScrollLeft;

        // 保存数据
        localStorage.setItem('exchangeList', JSON.stringify(state.exchangeListData));
        restartExchangeRefreshTimer();
    } catch (err) {
        console.error('渲染汇率列表失败：', err);
    } finally {
        state.isExchangeRefreshing = false;
    }
}

async function addExchange() {
    if (state.isExchangeRefreshing) return;
    const pair = ELEMENTS.exchangeCodeInput.value.trim().toUpperCase();
    if (!pair) return;
    const parsed = parseCurrencyPair(pair);
    if (!parsed) return;
    // 检查重复
    const isExist = state.exchangeListData.some(item => item.code === pair);
    if (isExist) {
        ELEMENTS.exchangeCodeInput.value = '';
        return;
    }
    // 添加并渲染
    state.exchangeListData.push({ code: pair });
    ELEMENTS.exchangeCodeInput.value = '';
    await renderExchangeList();
}

async function deleteExchange(index) {
    if (state.isExchangeRefreshing) return;
    state.exchangeListData.splice(index, 1);
    await renderExchangeList();
}

async function swapExchange(index) {
    if (state.isExchangeRefreshing) return;
    const oldPair = state.exchangeListData[index].code;
    const newPair = swapCurrencyPair(oldPair);
    if (state.exchangeListData.some(item => item.code === newPair)) return;
    // 更新数据并保存
    state.exchangeListData[index].code = newPair;
    localStorage.setItem('exchangeList', JSON.stringify(state.exchangeListData));
    await renderExchangeList();
}

function restartExchangeRefreshTimer() {
    if (!isTabActive()) return;
    stopExchangeRefreshTimer();

    if (state.exchangeListData.length > 0) {
        const refreshLoop = async () => {
            if (isTabActive() && !state.isExchangeRefreshing) {
                await renderExchangeList();
            }
            state.exchangeRefreshTimer = setTimeout(refreshLoop, state.exchangeRefreshInterval);
        };
        refreshLoop();
    }
}

function stopExchangeRefreshTimer() {
    if (state.exchangeRefreshTimer) {
        clearTimeout(state.exchangeRefreshTimer);
        state.exchangeRefreshTimer = null;
    }
}

// 绑定汇率事件
ELEMENTS.addExchangeBtn.addEventListener('click', addExchange);
ELEMENTS.exchangeCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addExchange();
});
ELEMENTS.exchangeList.addEventListener('click', async (e) => {
    const index = Number(e.target.dataset.index);
    if (isNaN(index)) return;
    if (e.target.classList.contains('swap_exchange_btn')) {
        await swapExchange(index);
    } else if (e.target.classList.contains('delete_exchange_btn')) {
        await deleteExchange(index);
    }
});
ELEMENTS.refreshBtn.addEventListener('click', async () => {
    if (!state.isExchangeRefreshing) await renderExchangeList();
});

// ========== 页面初始化/销毁（统一入口） ==========
// 页面加载初始化
async function initPage() {
    initLangAndSearch(); // 初始化语言/搜索
    renderTodos(); // 初始化待办
    // 修复：先启动天气定时器，再获取天气数据
    restartWeatherRefreshTimer(); // 先启动定时器
    getWeatherByIP(); // 再手动触发首次加载
    await renderExchangeList(); // 初始化汇率
    handleTabVisibilityChange(); // 初始化标签页状态
}

// 页面销毁清理
function destroyPage() {
    // 停止所有定时器
    stopWeatherRefreshTimer();
    stopExchangeRefreshTimer();
    // 中止请求
    if (state.fetchAbortController) {
        state.fetchAbortController.abort();
        state.fetchAbortController = null;
    }
    // 移除事件监听
    ['visibilitychange', 'msvisibilitychange', 'webkitvisibilitychange'].forEach(event => {
        document.removeEventListener(event, handleTabVisibilityChange);
    });
    // 清空DOM和状态
    ELEMENTS.exchangeList.innerHTML = '';
    ELEMENTS.todoList.innerHTML = '';
    ELEMENTS.weatherContainer.innerHTML = '';
    state = {
        todos: [],
        exchangeListData: [],
        lastExchangeRates: {},
        fetchAbortController: null,
        weatherRefreshTimer: null,
        exchangeRefreshTimer: null,
        isWeatherRefreshing: false,
        isExchangeRefreshing: false,
        exchangeRefreshInterval: CONFIG.EXCHANGE_REFRESH_BASE
    };
}

// 绑定初始化/销毁事件
window.addEventListener('load', initPage);
window.addEventListener('beforeunload', destroyPage);