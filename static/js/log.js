/**
 * 获取 URL 中的查询参数
 * @param {string} param - 要获取的参数名
 * @returns {string|null} - 返回参数值或 null
 */
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * 记录日志到后端
 * @param {string} endpoint - 后端接口的路径
 * @param {Object} data - 要发送的数据
 */
function sendLog(endpoint, data) {
    fetch(`http://43.136.129.192:5000/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(`Log successfully sent to ${endpoint}:`, data);
        })
        .catch((error) => {
            console.error(`Error sending log to ${endpoint}:`, error);
        });
}

/**
 * 页面加载时记录访问数据
 */
function initializeLogging() {
    const source = getQueryParam("source") || "direct"; // 来源参数
    const visitData = {
        source: source,
        userAgent: navigator.userAgent || "Unknown", // 浏览器和设备信息
        screenResolution: `${window.screen.width || 0}x${window.screen.height || 0}`, // 屏幕分辨率
        language: navigator.language || "Unknown", // 首选语言
        visitTime: new Date().toISOString(), // 访问时间
    };

    // 记录访问日志
    sendLog("log", visitData);

    // 初始化停留时间
    window.startTime = Date.now();
    window.totalDuration = 0; // 初始化总停留时间

    // 启动定时器，每隔 20 秒发送一次停留时间
    window.durationInterval = setInterval(() => {
        updateDurationLog();
    }, 20000); // 20 秒
}

/**
 * 更新用户停留时间日志
 */
function updateDurationLog() {
    const now = Date.now();
    const currentDuration = (now - window.startTime) / 1000; // 转换为秒
    window.totalDuration += currentDuration;
    window.startTime = now; // 重置开始时间

    // 构造日志数据
    const durationData = {
        source: getQueryParam("source") || "direct",
        duration: currentDuration.toFixed(2),
    };

    // 发送日志
    sendLog("log-duration", durationData);
    console.log(`Duration updated: ${currentDuration.toFixed(2)} seconds.`);
}

/**
 * 页面卸载时记录最终的停留时间
 */
function logFinalDuration() {
    // 停止定时器
    clearInterval(window.durationInterval);

    // 计算剩余时间
    const remainingDuration = (Date.now() - window.startTime) / 1000;
    window.totalDuration += remainingDuration;

    // 构造日志数据
    const durationData = {
        source: getQueryParam("source") || "direct",
        duration: remainingDuration.toFixed(2),
        totalDuration: window.totalDuration.toFixed(2),
    };

    // 发送最终日志
    sendLog("log-duration", durationData);
    console.log(`Final duration logged: ${window.totalDuration.toFixed(2)} seconds.`);
}

/**
 * 记录用户点击的按钮或链接
 */
function logClicks(event) {
    const target = event.target; // 获取点击目标
    const clickData = {
        tagName: target.tagName || "N/A", // 元素类型
        id: target.id || "N/A", // 元素 ID
        className: target.className || "N/A", // 元素类名
        text: target.innerText.slice(0, 100) || "N/A", // 截取文本内容
        href: target.href || "N/A", // 如果是链接，记录 href
        source: getQueryParam("source") || "direct",
    };

    sendLog("log-click", clickData);
    console.log("Click logged:", clickData);
}

/**
 * 重发未发送的日志（离线支持）
 */
function retryUnsentLogs() {
    const unsentLogs = JSON.parse(localStorage.getItem("unsentLogs") || "[]");
    if (unsentLogs.length > 0) {
        console.log(`Retrying ${unsentLogs.length} cached logs...`);
        unsentLogs.forEach(({ endpoint, data }) => sendLog(endpoint, data));
        localStorage.removeItem("unsentLogs"); // 重发成功后清空缓存
    }
}

/**
 * 缓存未发送的日志（离线支持）
 * @param {string} endpoint - 后端接口的路径
 * @param {Object} data - 要缓存的数据
 */
function cacheUnsentLog(endpoint, data) {
    const unsentLogs = JSON.parse(localStorage.getItem("unsentLogs") || "[]");
    unsentLogs.push({ endpoint, data });
    localStorage.setItem("unsentLogs", JSON.stringify(unsentLogs));
}

// 在日志发送失败时，启用离线缓存机制
function sendLogWithRetry(endpoint, data) {
    fetch(`http://43.136.129.192:5000/${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(`Log successfully sent to ${endpoint}:`, data);
        })
        .catch((error) => {
            console.error(`Error sending log to ${endpoint}, caching data:`, error);
            cacheUnsentLog(endpoint, data);
        });
}

// 页面加载完成时初始化
document.addEventListener("DOMContentLoaded", () => {
    initializeLogging();
    retryUnsentLogs();
});

// 页面可见性变化时记录时间
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        updateDurationLog(); // 页面隐藏时立即更新停留时间
    }
});

// 页面卸载时记录停留时间
window.addEventListener("beforeunload", logFinalDuration);
window.addEventListener("unload", logFinalDuration);

// 监听用户点击事件
document.addEventListener("click", logClicks);
