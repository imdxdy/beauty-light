const colorPicker = document.getElementById('colorPicker');
const video = document.getElementById('video');
const toggleBtn = document.getElementById('toggleCamera');
const saturation = document.getElementById('saturation');
const hue = document.getElementById('hue');
const brightness = document.getElementById('brightness');
const beauty = document.getElementById('beauty');
const captureBtn = document.getElementById('capture');
const recordBtn = document.getElementById('record');
const timer = document.getElementById('timer');
const gallery = document.getElementById('gallery');
let stream = null;
let currentFilter = '';
let mediaRecorder;
let recordedChunks = [];
let recording = false;
let startTime;
let autoMode = false;
let lastManualAdjust = 0;
const DEBOUNCE_DELAY = 100;
const AUTO_MODE_COOLDOWN = 5000;
let applyFiltersTimeout;

// 在文件顶部添加分辨率配置
const RESOLUTION_PRESETS = {
    desktop: [
        { width: 1920, height: 1080 },
        { width: 1280, height: 720 },
        { width: 640, height: 480 }
    ],
    mobile: [
        { width: { ideal: 1280 }, height: { ideal: 720 } },
        { width: { ideal: 720 }, height: { ideal: 1280 } },
        { width: { exact: 480 }, height: { exact: 640 } }
    ]
};

// 修改颜色设置逻辑
function setBackgroundColor(color) {
    document.body.style.setProperty('--current-bg', color);
    document.body.style.backgroundColor = color; // 兼容性回退
}

// 背景颜色控制
colorPicker.addEventListener('input', (e) => {
    const color = e.target.value;
    setBackgroundColor(color);
    
    // 找到匹配的预设按钮
    const matchedBtn = [...document.querySelectorAll('.color-presets button')]
        .find(btn => btn.dataset.color.toLowerCase() === color.toLowerCase());
    
    if (matchedBtn) {
        document.querySelectorAll('.color-presets button').forEach(b => 
            b.classList.remove('active'));
        matchedBtn.classList.add('active');
    }
});

// 摄像头控制
async function initCamera(constraints) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                ...constraints.video,
                // 添加移动端适配参数
                width: { ideal: Math.min(640, window.innerWidth) },
                height: { ideal: Math.min(480, window.innerHeight * 0.6) }
            }
        });
        
        // 移除手动尺寸设置
        video.srcObject = stream;
        video.play();
        return true;
    } catch (err) {
        console.error('摄像头初始化失败:', err);
        return false;
    }
}

// 修改摄像头切换事件
toggleBtn.addEventListener('click', async () => {
    if (!stream) {
        try {
            const isMobile = /Mobi|Android/i.test(navigator.userAgent);
            const resolutions = isMobile ? RESOLUTION_PRESETS.mobile : RESOLUTION_PRESETS.desktop;
            
            for (const resolution of resolutions) {
                const constraints = {
                    video: {
                        facingMode: 'user',
                        ...resolution
                    }
                };
                
                if (await initCamera(constraints)) {
                    video.srcObject = stream;
                    toggleBtn.textContent = '关闭摄像头';
                    showToast(`🎥 已启用 ${resolution.width}x${resolution.height} 分辨率`);
                    break;
                }
            }
            
            if (!stream) {
                throw new Error('无法找到合适的分辨率');
            }
        } catch (err) {
            alert('摄像头访问失败: ' + err.message);
        }
    } else {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        toggleBtn.textContent = '开启摄像头';
    }
});

// 添加窗口大小变化监听
window.addEventListener('resize', () => {
    if (stream) {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        video.style.width = `${Math.min(settings.width, window.innerWidth - 40)}px`;
    }
});

// 新增滤镜处理函数
function applyFilters(immediate = false) {
    clearTimeout(applyFiltersTimeout);
    const apply = () => {
        const sat = saturation.value / 100;
        const hueRotate = hue.value;
        const bright = brightness.value / 100;
        const beautyLevel = beauty.value / 100;
        
        video.style.filter = `
            saturate(${sat}) 
            hue-rotate(${hueRotate}deg) 
            brightness(${bright})
            contrast(${1 + beautyLevel * 0.3})
            blur(${beautyLevel * 0.8}px)
        `;
    };

    if (immediate) {
        apply();
    } else {
        applyFiltersTimeout = setTimeout(apply, DEBOUNCE_DELAY);
    }
}

// 修改事件监听部分
function updateSliderValue(slider, input) {
    input.value = slider.value;
    applyFilters();
}

// 为每个滑块和输入框添加双向绑定
document.querySelectorAll('.slider-item').forEach(item => {
    const slider = item.querySelector('input[type="range"]');
    const input = item.querySelector('input[type="number"]');
    
    // 滑块变化时更新输入框
    slider.addEventListener('input', () => {
        input.value = slider.value;
        applyFilters();
    });
    
    // 输入框变化时更新滑块
    input.addEventListener('change', () => {
        let value = Math.max(slider.min, Math.min(slider.max, input.value));
        slider.value = value;
        input.value = value; // 确保显示合法值
        applyFilters();
    });
});

// 修改推荐滤镜处理逻辑（移除背景设置）
document.querySelectorAll('.presets button').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        currentFilter = filter;
        
        // 定义滤镜参数配置
        const filterConfigs = {
            original: [100, 0, 100, 0],
            pink: [150, -20, 110, 80],
            cold: [80, 10, 130, 70],
            orange: [180, 30, 120, 60],
            vintage: [70, 40, 90, 30]
        };

        // 获取对应配置
        const [satVal, hueVal, brightVal, beautyVal] = filterConfigs[filter];

        // 按顺序设置参数并触发更新
        [
            { slider: saturation, value: satVal },
            { slider: hue, value: hueVal },
            { slider: brightness, value: brightVal },
            { slider: beauty, value: beautyVal }
        ].forEach(({ slider, value }) => {
            // 1. 更新滑块值
            slider.value = value;
            
            // 2. 找到对应的输入框并更新
            const input = slider.closest('.slider-item').querySelector('.value-input');
            input.value = value;
            
            // 3. 立即触发input事件
            const event = new Event('input', { bubbles: true });
            slider.dispatchEvent(event);
        });

        // 立即应用滤镜（绕过防抖）
        clearTimeout(applyFiltersTimeout);
        applyFilters(true);
    });
});

// 新增颜色预设功能
document.querySelectorAll('.color-presets button').forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        colorPicker.value = color;
        setBackgroundColor(color);
        
        // 添加选中状态
        document.querySelectorAll('.color-presets button').forEach(b => 
            b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 新增动态粒子效果
function createParticles() {
    const particles = document.createElement('div');
    particles.style.position = 'fixed';
    particles.style.pointerEvents = 'none';
    document.body.appendChild(particles);

    function generateParticle() {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: linear-gradient(45deg, #ff9a9e, #fad0c4);
            border-radius: 50%;
            animation: float 3s infinite;
        `;
        
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.top = '-10px';
        particles.appendChild(particle);
        
        setTimeout(() => particle.remove(), 3000);
    }
    
    setInterval(generateParticle, 300);
}

createParticles();

// 新增美颜说明
const beautyTooltip = document.createElement('div');
beautyTooltip.textContent = "美颜级别：0-30自然妆效，50-80网红美颜，100极致磨皮";
beautyTooltip.style = "position:fixed; bottom:20px; color:#666; font-size:12px;";
document.body.appendChild(beautyTooltip);

// 拍照功能
captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.className = 'photo-item';
    
    // 添加下载链接
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `自拍_${new Date().toLocaleString().replace(/:/g,'-')}.png`;
    link.appendChild(img);
    
    gallery.prepend(link);
    
    // 添加删除功能
    img.oncontextmenu = (e) => {
        e.preventDefault();
        link.remove();
    };
});

// 录像功能
recordBtn.addEventListener('click', () => {
    if (!recording) {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
        mediaRecorder.onstop = exportVideo;
        
        mediaRecorder.start();
        startTime = Date.now();
        updateTimer();
        recordBtn.textContent = '⏹ 停止录制';
        recordBtn.style.background = '#9E9E9E';
        timer.style.display = 'inline';
        recording = true;
    } else {
        mediaRecorder.stop();
        recordBtn.textContent = '⏺ 开始录制';
        recordBtn.style.background = '#f44336';
        timer.style.display = 'none';
        recording = false;
    }
});

// 更新计时器
function updateTimer() {
    if (!recording) return;
    const elapsed = Math.floor((Date.now() - startTime)/1000);
    const minutes = String(Math.floor(elapsed/60)).padStart(2,'0');
    const seconds = String(elapsed%60).padStart(2,'0');
    timer.textContent = `⏱ ${minutes}:${seconds}`;
    requestAnimationFrame(updateTimer);
}

// 导出视频
function exportVideo() {
    const blob = new Blob(recordedChunks, {type: 'video/webm'});
    const url = URL.createObjectURL(blob);
    
    const videoElement = document.createElement('video');
    videoElement.controls = true;
    videoElement.src = url;
    videoElement.className = 'photo-item';
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `录像_${new Date().toLocaleString().replace(/:/g,'-')}.webm`;
    link.textContent = '下载视频';
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.appendChild(videoElement);
    container.appendChild(link);
    
    gallery.prepend(container);
}

// 自动模式按钮
const autoModeBtn = document.getElementById('autoMode');
autoModeBtn.addEventListener('click', () => {
    autoMode = !autoMode;
    autoModeBtn.classList.toggle('auto-mode-active');
    autoModeBtn.textContent = autoMode ? '🤖 自动模式中' : '🌞 自动模式';
});

// 环境光检测
function initAmbientLight() {
    if ('AmbientLightSensor' in window) {
        try {
            const sensor = new AmbientLightSensor();
            sensor.addEventListener('reading', () => {
                if (!autoMode || Date.now() - lastManualAdjust < AUTO_MODE_COOLDOWN) return;
                adjustByLight(sensor.illuminance);
            });
            sensor.start();
        } catch (err) {
            console.error('环境光传感器不可用:', err);
            autoModeBtn.disabled = true;
        }
    } else {
        autoModeBtn.disabled = true;
    }
}

// 自动调节逻辑
function adjustByLight(lux) {
    // 光照范围参考：
    // 0-50 lux：黑暗环境（夜晚室内）
    // 50-200：一般室内
    // 200-1000：明亮室内/阴天
    // 1000+：日光直射
    
    let targetBrightness, targetBeauty;
    
    if (lux < 50) {
        targetBrightness = 150;
        targetBeauty = 80;
    } else if (lux < 200) {
        targetBrightness = 120;
        targetBeauty = 60;
    } else if (lux < 1000) {
        targetBrightness = 100;
        targetBeauty = 40;
    } else {
        targetBrightness = 80;
        targetBeauty = 20;
    }
    
    // 平滑过渡
    brightness.value = smoothAdjust(brightness.value, targetBrightness);
    beauty.value = smoothAdjust(beauty.value, targetBeauty);
    
    // 更新显示值
    document.querySelectorAll('.value-input').forEach(input => {
        const slider = input.previousElementSibling;
        input.value = slider.value;
    });
    
    applyFilters();
}

// 平滑过渡函数
function smoothAdjust(current, target) {
    const diff = target - current;
    return current + diff * 0.3; // 30%的渐进调整
}

// 在手动调整时记录时间
document.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
    input.addEventListener('input', () => {
        lastManualAdjust = Date.now();
    });
});

// 新增自定义滤镜功能
const saveFilterBtn = document.getElementById('saveFilter');
const savedFiltersDiv = document.getElementById('savedFilters');

// 保存当前设置
saveFilterBtn.addEventListener('click', () => {
    const name = prompt('请输入滤镜名称（最多10个字）:');
    if (!name || name.length > 10) return;
    
    const filterData = {
        name,
        color: colorPicker.value,
        saturation: saturation.value,
        hue: hue.value,
        brightness: brightness.value,
        beauty: beauty.value,
        filter: currentFilter
    };
    
    // 保存到 localStorage
    localStorage.setItem(`filter_${name}`, JSON.stringify(filterData));
    renderSavedFilters();
    showToast('💖 滤镜保存成功！');
});

// 渲染已保存滤镜
function renderSavedFilters() {
    savedFiltersDiv.innerHTML = '';
    for(let i=0; i<localStorage.length; i++) {
        const key = localStorage.key(i);
        if(!key.startsWith('filter_')) continue;
        
        const data = JSON.parse(localStorage.getItem(key));
        const btn = document.createElement('button');
        btn.className = 'saved-filter';
        btn.textContent = data.name;
        btn.dataset.filterKey = key;
        
        btn.addEventListener('click', () => loadFilter(data));
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if(confirm(`确定删除 "${data.name}" 滤镜吗？`)) {
                localStorage.removeItem(key);
                btn.remove();
                showToast('🗑️ 滤镜已删除');
            }
        });
        
        savedFiltersDiv.appendChild(btn);
    }
}

// 加载滤镜
function loadFilter(data) {
    colorPicker.value = data.color;
    saturation.value = data.saturation;
    hue.value = data.hue;
    brightness.value = data.brightness;
    beauty.value = data.beauty;
    currentFilter = data.filter;
    
    // 更新所有输入框
    document.querySelectorAll('.value-input').forEach(input => {
        const slider = input.previousElementSibling;
        input.value = slider.value;
    });
    
    // 应用设置
    document.body.style.backgroundColor = data.color;
    applyFilters();
    showToast(`✨ 已应用 ${data.name} 滤镜`);
}

// 初始化时渲染已保存滤镜
renderSavedFilters();

// 提示信息
function showToast(text) {
    const toast = document.createElement('div');
    toast.textContent = text;
    toast.style = `
        position: fixed;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        animation: fadeOut 2s forwards;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// 在初始化时调用
initAmbientLight();

// 初始化时同步颜色
document.querySelector(`.color-presets button[data-color="${colorPicker.value}"]`)
    ?.classList.add('active');

// 初始化时设置默认颜色
setBackgroundColor(colorPicker.value); 