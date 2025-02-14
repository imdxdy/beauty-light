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

// 修改分辨率预设
const RESOLUTION_PRESETS = {
    desktop: [
        { width: 1920, height: 1080 },  // 16:9 横屏
        { width: 1280, height: 720 },   // 16:9
        { width: 640, height: 480 }      // 4:3
    ],
    mobile: [
        { width: { ideal: 720 }, height: { ideal: 1280 } }, // 9:16 竖屏
        { width: { ideal: 480 }, height: { ideal: 640 } },    // 3:4
        { width: { exact: 360 }, height: { exact: 640 } }    // 9:16
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
                facingMode: 'user'
            }
        });
        
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // 自动旋转逻辑
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        video.style.width = isMobile ? 
            `${Math.min(settings.height, window.innerWidth)}px` : 
            `${Math.min(settings.width, window.innerWidth - 40)}px`;
            
        video.style.height = 'auto';
        
        return true;
    } catch (err) {
        console.error('摄像头初始化失败:', err);
        return false;
    }
}

// 添加自动初始化逻辑
document.addEventListener('DOMContentLoaded', async () => {
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
});

// 添加窗口大小变化监听
window.addEventListener('resize', () => {
    if (stream) {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        video.style.width = `${Math.min(settings.width, window.innerWidth - 40)}px`;
    }
});

// 添加屏幕方向监听
window.addEventListener('orientationchange', () => {
    if (stream) {
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        video.style.width = `${Math.min(settings.width, window.innerWidth)}px`;
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
        
        const filterConfigs = {
            original: [100, 0, 100, 20],    // 素颜
            pink:     [140, -15, 110, 60],  // 粉嫩
            cold:     [80, 10, 130, 40],    // 冷白皮
            orange:   [160, 25, 110, 30],   // 元气橙
            vintage:  [60, 40, 90, 10]      // 复古
        };
        
        const [satVal, hueVal, brightVal, beautyVal] = filterConfigs[filter];
        
        // 更新所有滑块和输入框
        [
            [saturation, satVal],
            [hue, hueVal],
            [brightness, brightVal],
            [beauty, beautyVal]
        ].forEach(([slider, value]) => {
            slider.value = value;
            const input = slider.closest('.slider-item').querySelector('.value-input');
            input.value = value;
        });
        
        applyFilters(true);
        showToast(`✨ 已应用 ${btn.textContent.trim()} 滤镜`);
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

// 修改拍照功能
captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = video.style.filter;
    ctx.drawImage(video, 0, 0);
    
    // 直接保存不显示在页面
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `selfie_${new Date().toISOString().slice(0,19).replace(/T/g,'_').replace(/-/g,'')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('📸 照片已保存');
});

// 修改录制按钮逻辑
let recordingSeconds = 0;
let timerHandle = null;

recordBtn.addEventListener('click', () => {
    if (!recording) {
        // 开始录制
        startRecording();
        recordBtn.innerHTML = `⏹ 0秒`;
        recordingSeconds = 0;
        timerHandle = setInterval(() => {
            recordingSeconds++;
            recordBtn.innerHTML = `⏹ ${recordingSeconds}秒`;
        }, 1000);
    } else {
        // 结束录制
        clearInterval(timerHandle);
        stopRecording();
        recordBtn.innerHTML = '⏺ 录制';
    }
});

// 修改保存录制逻辑
function saveRecording() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const filename = `recording_${new Date().toISOString().slice(0,19).replace(/T/g,'_').replace(/-/g,'')}_${recordingSeconds}s.webm`;
    
    // 创建虚拟点击下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast(`✅ 已保存 ${recordingSeconds}秒录制`);
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

// 录制功能
function startRecording() {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = saveRecording;
    mediaRecorder.start();
    recording = true;
    startTime = Date.now();
    showToast('⏺ 开始录制');
}

function stopRecording() {
    mediaRecorder.stop();
    recording = false;
    clearInterval(timerHandle);
    showToast('⏹ 录制已保存');
}

let timerInterval;
function updateTimer() {
    timerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        timer.textContent = `⏱ ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
} 