// 기본 설정
const API_KEY = "a82bb7faf7025eb08bc62e691bbeb3e7"; // OpenWeatherMap API Key
const BASE_URL = "https://api.openweathermap.org/data/2.5";// 플랩식 디스플레이에서 사용할 문자열 세트
const CHARS = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-°%.";


// FlapChar
class FlapChar {
    constructor(element) {
        this.element = element;
        this.currentChar = ' ';
        this.isAnimating = false;
        

        this.element.innerHTML = `
            <div class="card top static-top"> </div>
            <div class="card bottom static-bottom"> </div>
            <div class="flap-leaf">
                <div class="front"> </div>
                <div class="back"> </div>
            </div>
        `;
        
        this.staticTop = this.element.querySelector('.static-top');
        this.staticBottom = this.element.querySelector('.static-bottom');
        this.leaf = this.element.querySelector('.flap-leaf');
        this.leafFront = this.leaf.querySelector('.front');
        this.leafBack = this.leaf.querySelector('.back');
    }


    // 목표 글자까지 순차적으로 넘기는 재귀 함수
    setChar(targetChar) {
        // 문자셋에 없는 글자는 공백 처리
        if (CHARS.indexOf(targetChar) === -1) targetChar = ' ';
        if (this.currentChar === targetChar) return;

        let currentIdx = CHARS.indexOf(this.currentChar);
        let nextIdx = (currentIdx + 1) % CHARS.length;
        const nextChar = CHARS[nextIdx];

        // 한 번 뒤집고, 목표 글자가 아니면 다시 setChar 호출 (재귀)
        this.flip(nextChar, () => {
            if (nextChar !== targetChar) {
                setTimeout(() => this.setChar(targetChar), 40); // 0.04초 간격으로 회전
            }
        });
    }

    // 실제 3D 회전 애니메이션 수행 함수
    flip(nextChar, callback) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const current = this.currentChar;
        
        // 다음 상태 미리 세팅
        this.staticTop.textContent = nextChar;
        this.staticBottom.textContent = current;
        this.leafFront.textContent = current;
        this.leafBack.textContent = nextChar;


        this.leaf.classList.remove('flipping');
        void this.leaf.offsetWidth;
        this.leaf.classList.add('flipping');

        // 애니메이션 종료 후 정리
        setTimeout(() => {
            this.currentChar = nextChar;
            this.staticBottom.textContent = nextChar;
            this.leafFront.textContent = nextChar;
            this.leaf.classList.remove('flipping');
            this.isAnimating = false;
            if (callback) callback();
        }, 150);
    }
}


// FlapDisplay
class FlapDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.length = parseInt(this.container.dataset.length || 10);
        this.flaps = [];

        for (let i = 0; i < this.length; i++) {
            const div = document.createElement('div');
            div.className = 'flap-char';
            this.container.appendChild(div);
            this.flaps.push(new FlapChar(div));
        }
    }

    // 문자열을 받아 각 글자 플랩에 전달
    update(text) {
        // 대문자 변환 및 빈 공간 공백 채움
        const formattedText = String(text).toUpperCase().padEnd(this.length, ' ');
        
        [...formattedText].forEach((char, index) => {
            if (index < this.flaps.length) {
                setTimeout(() => {
                    this.flaps[index].setChar(char);
                }, index * 80); 
            }
        });
    }
}


// 초기화 및 전역 변수 설정
// 각 정보창을 담당할 FlapDisplay 인스턴스 생성
const displays = {
    city: new FlapDisplay('flap-city'),
    temp: new FlapDisplay('flap-temp'),
    cond: new FlapDisplay('flap-cond'),
    humid: new FlapDisplay('flap-humid'),
    wind: new FlapDisplay('flap-wind')
};

// DOM 요소 선택
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const weatherSection = document.getElementById("weatherSection");
const errorMessage = document.getElementById("errorMessage");
const toggleUnitBtn = document.getElementById("toggleUnit");

let isCelsius = true;      // 현재 단위 상태 (true: 섭씨, false: 화씨)
let lastWeatherData = null; // 단위 변환 시 재사용할 데이터 캐시


// 이벤트 리스너 등록
// 검색 버튼 클릭 시
searchBtn.addEventListener("click", () => {
    const city = cityInput.value;
    if (city) handleSearch(city);
});

// 엔터키 입력 시
cityInput.addEventListener("keypress", (e) => { 
    if(e.key === "Enter" && cityInput.value) handleSearch(cityInput.value); 
});

// 단위 변환 버튼 클릭 시
toggleUnitBtn.addEventListener("click", () => {
    isCelsius = !isCelsius;
    toggleUnitBtn.textContent = isCelsius ? "°C/°F" : "°F/°C";
    if (lastWeatherData) updateDisplay(lastWeatherData.current, lastWeatherData.forecast);
});


// 페이지 로드 완료 시 최근 검색어 불러오기
document.addEventListener("DOMContentLoaded", loadRecentSearches);


// 최근 검색
// 저장된 검색어 불러와서 버튼 만들기
function loadRecentSearches() {
    const recentContainer = document.getElementById("recentSearch");
    if (!recentContainer) return;

    const searches = JSON.parse(localStorage.getItem("weather_recent")) || [];
    recentContainer.innerHTML = "";

    searches.forEach(city => {
        const btn = document.createElement("button");
        btn.className = "recent-btn";
        btn.textContent = city;
        btn.addEventListener("click", () => {
            cityInput.value = city;
            handleSearch(city);
        });
        recentContainer.appendChild(btn);
    });
}


// 검색 성공 시  저장
function saveRecentSearch(city) {
    let searches = JSON.parse(localStorage.getItem("weather_recent")) || [];
    
    // 중복 제거 및 최신 검색어를 맨 앞으로 이동
    searches = searches.filter(item => item.toUpperCase() !== city.toUpperCase());
    searches.unshift(city.toUpperCase());
    
    // 최대 5개까지만 저장
    if (searches.length > 5) searches.pop();
    
    localStorage.setItem("weather_recent", JSON.stringify(searches));
    loadRecentSearches();
}


// API 호출 및 처리
async function handleSearch(city) {
    try {
        errorMessage.classList.add("hidden");
        

        const [current, forecast] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric`).then(r => r.json()),
            fetch(`${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&units=metric`).then(r => r.json())
        ]);

        // API 에러 처리
        if (current.cod !== 200) throw new Error(current.message);


        // 데이터 캐싱 및 화면 업데이트
        lastWeatherData = { current, forecast };
        updateDisplay(current, forecast);
        saveRecentSearch(city); // 검색 성공 시에만 저장
        weatherSection.classList.remove("hidden"); // 결과 화면 표시


    } catch (error) {
        console.error(error);
        errorMessage.textContent = "CITY NOT FOUND. CHECK SPELLING.";
        errorMessage.classList.remove("hidden");
    }
}

// 온도 단위 변환
function getTempStr(temp) {
    const val = isCelsius ? Math.round(temp) : Math.round(temp * 1.8 + 32);
    const unit = isCelsius ? "°C" : "°F";
    return `${val}${unit}`;
}


//  옷차림 추천
function getAdvice(temp, weatherId) {
    let advice = "";
    if (temp >= 27) advice = "민소매, 반바지, 반팔티, 치마";
    else if (temp >= 23) advice = "반팔티, 얇은 셔츠, 반바지, 면바지";
    else if (temp >= 20) advice = "긴팔티, 가디건, 면바지, 청바지";
    else if (temp >= 17) advice = "얇은 니트, 맨투맨, 가디건, 청바지";
    else if (temp >= 12) advice = "재킷, 가디건, 야상, 스타킹";
    else if (temp >= 10) advice = "트렌치코트, 니트, 청바지";
    else if (temp >= 6)  advice = "코트, 가죽 재킷, 니트, 스카프";
    else advice = "패딩, 두꺼운 코트, 목도리, 기모";
    
    return advice;
}


// 화면 업데이트
function updateDisplay(current, forecast) {
    // 플랩식 안내판
    displays.city.update(current.name);
    displays.temp.update(getTempStr(current.main.temp));
    displays.cond.update(current.weather[0].main);
    displays.humid.update(current.main.humidity + "%");
    displays.wind.update(current.wind.speed.toFixed(1));

    // 날씨 아이콘
    document.getElementById("weatherIcon").src = `https://openweathermap.org/img/wn/${current.weather[0].icon}.png`;

    // 옷차림 패널
    const adviceText = getAdvice(current.main.temp, current.weather[0].id);
    const adviceEl = document.getElementById("adviceDisplay");
    if(adviceEl) adviceEl.textContent = adviceText;

    // 5일 예보
    const grid = document.getElementById("forecastGrid");
    grid.innerHTML = "";
    let delay = 0;


    // 3시간 간격 데이터를 24시간 간격으로 건너뛰며 표시
    for (let i = 0; i < forecast.list.length; i += 8) {
        const day = forecast.list[i];
        const date = new Date(day.dt * 1000);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const tempStr = getTempStr(day.main.temp);
        
        // 예보 카드 생성
        const card = document.createElement("div");
        card.className = "crt-monitor animate-crt";
        card.style.animationDelay = `${delay}s`;
        delay += 0.2;

        card.innerHTML = `
            <div style="font-size:0.8rem; margin-bottom:5px;">${dateStr}</div>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png">
            <div style="font-size:1.2rem; font-weight:bold; margin-top:5px;">${tempStr}</div>
        `;
        grid.appendChild(card);
    }
}


//시계 및 시간대별 배경색 변경
const DAY_BG = "#2a2a2a";   // 낮 배경
const NIGHT_BG = "#0a0a0a"; // 밤 배경

function updateClock() {
    const now = new Date();
    
    // 시간 업데이트
    const timeString = now.toLocaleTimeString('en-GB', { hour12: false });
    const clockEl = document.getElementById("digitalClock");
    if(clockEl) clockEl.textContent = timeString;

    // 날짜 업데이트
    const dateEl = document.getElementById("dateDisplay");
    if(dateEl) {
        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const dayName = days[now.getDay()];
        dateEl.textContent = `${month}/${date} ${dayName}`;
    }

    // 시간에 따른 배경색 변경
    const hour = now.getHours();
    const root = document.documentElement;
    if (hour >= 6 && hour < 18) {
        root.style.setProperty('--bg-color', DAY_BG);
    } else {
        root.style.setProperty('--bg-color', NIGHT_BG);
    }
}

// 1초마다 시계 갱신
setInterval(updateClock, 1000);
updateClock(); // 로딩 즉시 실행