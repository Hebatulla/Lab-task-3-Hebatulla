
const WEATHER_CODES = {
  0:  { desc: 'Clear sky',              emoji: '☀️'  },
  1:  { desc: 'Mainly clear',           emoji: '🌤️'  },
  2:  { desc: 'Partly cloudy',          emoji: '⛅'   },
  3:  { desc: 'Overcast',              emoji: '☁️'  },
  45: { desc: 'Foggy',                 emoji: '🌫️'  },
  48: { desc: 'Depositing rime fog',   emoji: '🌫️'  },
  51: { desc: 'Light drizzle',         emoji: '🌦️'  },
  53: { desc: 'Moderate drizzle',      emoji: '🌦️'  },
  55: { desc: 'Dense drizzle',         emoji: '🌧️'  },
  61: { desc: 'Slight rain',           emoji: '🌧️'  },
  63: { desc: 'Moderate rain',         emoji: '🌧️'  },
  65: { desc: 'Heavy rain',            emoji: '🌧️'  },
  71: { desc: 'Slight snow fall',      emoji: '🌨️'  },
  73: { desc: 'Moderate snow fall',    emoji: '🌨️'  },
  75: { desc: 'Heavy snow fall',       emoji: '❄️'  },
  77: { desc: 'Snow grains',           emoji: '🌨️'  },
  80: { desc: 'Slight rain showers',   emoji: '🌦️'  },
  81: { desc: 'Moderate rain showers', emoji: '🌦️'  },
  82: { desc: 'Violent rain showers',  emoji: '⛈️'  },
  85: { desc: 'Slight snow showers',   emoji: '🌨️'  },
  86: { desc: 'Heavy snow showers',    emoji: '❄️'  },
  95: { desc: 'Thunderstorm',          emoji: '⛈️'  },
  96: { desc: 'Thunderstorm w/ hail',  emoji: '⛈️'  },
  99: { desc: 'Thunderstorm w/ heavy hail', emoji: '⛈️' },
};

/**
 * Returns weather code info, falling back to a default if code unknown.
 * @param {number} code
 * @returns {{ desc: string, emoji: string }}
 */
function getWeatherInfo(code) {
  return WEATHER_CODES[code] ?? { desc: 'Unknown conditions', emoji: '🌡️' };
}

/* ============================================================
   2. STATE — module-level variables (no globals leaked to window)
   ============================================================ */
let currentUnit = 'C';         // 'C' or 'F' — for bonus unit toggle
let lastWeatherData = null;    // cached raw API data for unit conversion
let lastSearchQuery = '';      // for retry functionality



/**
 * Debounce — wraps fn so it fires only after `delay` ms of inactivity.
 * Task 4 — Step 18: debounce delay 500 ms.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timerId;
  return function (...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Converts Celsius to Fahrenheit.
 * @param {number} celsius
 * @returns {number}
 */
function toFahrenheit(celsius) {
  return Math.round(celsius * 9 / 5 + 32);
}

/**
 * Formats a display temperature based on currentUnit.
 * @param {number} celsiusValue
 * @returns {string}
 */
function formatTemp(celsiusValue) {
  if (currentUnit === 'F') return `${toFahrenheit(celsiusValue)}`;
  return `${Math.round(celsiusValue)}`;
}

/**
 * Returns the abbreviated day name .
 * @param {string} dateStr
 * @returns {string}
 */
function getDayName(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
}

/**
 * Shows the error banner with a custom message.
 * Task 4 — Step 16/19.
 * @param {string} message
 */
function showError(message) {
  const banner = document.getElementById('error-banner');
  document.getElementById('error-message').textContent = message;
  banner.classList.remove('hidden');
}

/** Hides the error banner. */
function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

/**
 * Shows the validation message below the search bar.

 * @param {string} msg
 */
function showValidation(msg) {
  const el = document.getElementById('validation-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/** Hides the inline validation message. */
function hideValidation() {
  document.getElementById('validation-msg').classList.add('hidden');
}


function showSkeletons() {
  // Current card
  document.getElementById('city-name').classList.add('skeleton', 'skeleton-text');
  document.getElementById('local-time').classList.add('skeleton', 'skeleton-sm');
  document.getElementById('weather-icon-big').classList.add('skeleton', 'skeleton-icon');
  document.getElementById('temperature').classList.add('skeleton', 'skeleton-temp');
  document.getElementById('weather-desc').classList.add('skeleton', 'skeleton-text');
  document.getElementById('humidity').classList.add('skeleton', 'skeleton-sm');
  document.getElementById('wind-speed').classList.add('skeleton', 'skeleton-sm');
  document.getElementById('feels-like').classList.add('skeleton', 'skeleton-sm');

  // Forecast row — rebuild 7 skeleton cards
  const forecastRow = document.getElementById('forecast-row');
  forecastRow.innerHTML = Array(7).fill(0).map(() => `
    <div class="forecast-card skeleton-card">
      <div class="fc-day skeleton skeleton-sm"></div>
      <div class="fc-icon skeleton skeleton-icon-sm"></div>
      <div class="fc-temps">
        <span class="skeleton skeleton-sm"></span>
        <span class="skeleton skeleton-sm"></span>
      </div>
    </div>
  `).join('');
}

/**
 * Removes all skeleton classes from the current weather card
 * so the real data is visible.
 */
function removeSkeletons() {
  const skeletonClasses = ['skeleton', 'skeleton-text', 'skeleton-sm', 'skeleton-temp', 'skeleton-icon', 'skeleton-icon-sm'];
  document.querySelectorAll('.skeleton').forEach(el => {
    el.classList.remove(...skeletonClasses);
  });
}


/**
 * Resolves a city name to { latitude, longitude, timezone } using
 * the Open-Meteo Geocoding API.
 * Task 2 — Step 5 & 6.
 * @param {string} city
 * @param {AbortSignal} signal
 * @returns {Promise<{ latitude: number, longitude: number, timezone: string, name: string }|null>}
 */
async function geocodeCity(city, signal) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url, { signal });

  // Task 4 — Step 16: explicit HTTP error handling
  if (!response.ok) {
    throw new Error(`Geocoding request failed — HTTP ${response.status}`);
  }

  const data = await response.json();

  // Task 2 here Step 6:
  if (!data.results || data.results.length === 0) {
    return null;
  }

  const { latitude, longitude, timezone, name, country } = data.results[0];
  return { latitude, longitude, timezone, name, country };
}

/**
 * Fetches current + 7-day weather from Open-Meteo forecast API.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} signal
 * @returns {Promise<Object>} raw API response
 */
async function fetchWeather(lat, lon, signal) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current_weather: 'true',
    hourly: 'temperature_2m,relativehumidity_2m,windspeed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,weathercode',
    timezone: 'auto',
    forecast_days: '7',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const response = await fetch(url, { signal });

  // Task 4 — Step 16: explicit HTTP error check
  if (!response.ok) {
    throw new Error(`Weather request failed — HTTP ${response.status}`);
  }

  return response.json();
}

/**

 * @param {{ name: string, country: string }} geoResult
 * @param {Object} weatherData
 */
function populateCurrentWeather(geoResult, weatherData) {
  const { current_weather, hourly } = weatherData;
  const weatherInfo = getWeatherInfo(current_weather.weathercode);

  // Find current hour index in hourly arrays to get humidity
  const currentHourStr = current_weather.time.slice(0, 13); // 'YYYY-MM-DDTHH'
  const hourIndex = hourly.time.findIndex(t => t.startsWith(currentHourStr));
  const humidity  = hourIndex >= 0 ? hourly.relativehumidity_2m[hourIndex] : '--';

  // Cache for unit toggle
  lastWeatherData = {
    geoResult,
    weatherData,
    tempC: current_weather.temperature,
    windspeed: current_weather.windspeed,
    humidity,
    // Feels-like approximation using wind chill / heat index concepts
    feelsLikeC: current_weather.temperature - (current_weather.windspeed * 0.1),
  };

  document.getElementById('city-name').textContent = `${geoResult.name}, ${geoResult.country}`;
  document.getElementById('weather-icon-big').textContent = weatherInfo.emoji;
  document.getElementById('temperature').textContent = formatTemp(lastWeatherData.tempC);
  document.getElementById('temp-unit-display').textContent = `°${currentUnit}`;
  document.getElementById('weather-desc').textContent = weatherInfo.desc;
  document.getElementById('humidity').textContent = `${humidity}%`;
  document.getElementById('wind-speed').textContent = `${current_weather.windspeed} km/h`;
  document.getElementById('feels-like').textContent = `${formatTemp(lastWeatherData.feelsLikeC)}°${currentUnit}`;

  // Remove skeletons once data is rendered (Task 2 — Step 8)
  removeSkeletons();
}

/**
 * Populates the 7-day forecast row.
 * @param {Object} weatherData
 */
function populateForecast(weatherData) {
  const { daily } = weatherData;
  const forecastRow = document.getElementById('forecast-row');
  forecastRow.innerHTML = '';

  daily.time.forEach((dateStr, i) => {
    const info = getWeatherInfo(daily.weathercode[i]);
    const maxC = daily.temperature_2m_max[i];
    const minC = daily.temperature_2m_min[i];

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <span class="fc-day">${i === 0 ? 'Today' : getDayName(dateStr)}</span>
      <span class="fc-icon">${info.emoji}</span>
      <div class="fc-temps">
        <span class="fc-high">${formatTemp(maxC)}°</span>
        <span class="fc-low">${formatTemp(minC)}°</span>
      </div>
    `;
    forecastRow.appendChild(card);
  });
}

/* 
   6. TASK 3 — jQuery AJAX: Local Time Integration*/

/**
 * Fetches the local time for the city's timezone using WorldTimeAPI
 * via jQuery's $.getJSON() method, with .done()/.fail()/.always() chaining.
 
 * @param {string} timezone  e.g. "Asia/Kuala_Lumpur"
 */
function fetchLocalTime(timezone) {
  const url = `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`;

  // Task 3 — Step 14: use .done(), .fail(), .always() chaining
  $.getJSON(url)
    .done(function (data) {
      // Task 3 — Step 12: display local time
      const dt = new Date(data.datetime);
      const timeStr = dt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const el = document.getElementById('local-time');
      el.textContent = `🕐 ${timeStr} local time`;
      el.classList.remove('skeleton', 'skeleton-sm');
    })
    .fail(function () {
      // Task 3 — Step 13: fallback to browser's local time
      const fallback = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const el = document.getElementById('local-time');
      el.textContent = `🕐 ${fallback} (local)`;
      el.classList.remove('skeleton', 'skeleton-sm');
    })
    .always(function () {
      // Task 3 — Step 15: log timestamp on completion
      const ts = new Date().toISOString();
      console.log(`[WeatherNow] WorldTimeAPI request completed at ${ts}`);
    });
}



/**
 * Orchestrates the full data fetch: geocoding → weather → time.
 * @param {string} city
 */
async function searchCity(city) {
  // Task 4 — Step 17: validate minimum 2 characters
  if (!city || city.trim().length < 2) {
    showValidation('Please enter at least 2 characters.');
    return;
  }

  hideValidation();
  hideError();
  showSkeletons();
  lastSearchQuery = city.trim();

  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // ── Step 5: Geocode the city name 
    const geoResult = await geocodeCity(city.trim(), controller.signal);

    // ── Step 6: No results → show error state, do NOT throw ───
    if (!geoResult) {
      showError(`City "${city}" not found. Please try a different name.`);
      // Restore skeleton text to neutral placeholder
      document.getElementById('city-name').textContent = 'City not found';
      document.getElementById('city-name').classList.remove('skeleton', 'skeleton-text');
      clearTimeout(timeoutId);
      return;
    }

    // ── Steps 7 & 8:
    const weatherData = await fetchWeather(geoResult.latitude, geoResult.longitude, controller.signal);
    clearTimeout(timeoutId);

    // ── Step 8: Populate UI with real data 
    populateCurrentWeather(geoResult, weatherData);
    populateForecast(weatherData);

    // ── Bonus
    saveRecentSearch(geoResult.name);

    
    fetchLocalTime(geoResult.timezone);

  } catch (err) {
    clearTimeout(timeoutId);

    
    if (err.name === 'AbortError') {
      showError('Request timed out after 10 seconds. Check your connection and try again.');
    } else {
      // Task 2 — Step 9: network / HTTP errors → error banner with retry
      showError(`Network error: ${err.message}`);
    }

    console.error('[WeatherNow] Fetch error:', err);
  }
}

/* =
   8.BONUS Recent Searches (localStorage)
   */
const RECENT_KEY = 'weathernow_recent';
const MAX_RECENT = 5;

/** Saves a city name to the recent searches list in localStorage. */
function saveRecentSearch(cityName) {
  let recent = getRecentSearches();
  // Remove duplicate (case-insensitive)
  recent = recent.filter(c => c.toLowerCase() !== cityName.toLowerCase());
  recent.unshift(cityName);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  renderChips(recent);
}

/** Returns the stored recent searches array, or empty array. */
function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? [];
  } catch {
    return [];
  }
}

/**
 * Renders recent-search chips below the search bar.
 * @param {string[]} cities
 */
function renderChips(cities) {
  const container = document.getElementById('chips-container');
  const wrapper   = document.getElementById('recent-searches');
  container.innerHTML = '';

  if (cities.length === 0) {
    wrapper.classList.add('hidden');
    return;
  }

  wrapper.classList.remove('hidden');

  cities.forEach(city => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = city;
    chip.addEventListener('click', () => {
      document.getElementById('search-input').value = city;
      searchCity(city);
    });
    container.appendChild(chip);
  });
}

/* ============================================================
   9. BONUS — Celsius /Fahrenheit Toggle
   */

/** Updates all displayed temperatures from cached lastWeatherData. */
function applyUnitToggle() {
  if (!lastWeatherData) return;

  document.getElementById('temperature').textContent = formatTemp(lastWeatherData.tempC);
  document.getElementById('temp-unit-display').textContent = `°${currentUnit}`;
  document.getElementById('feels-like').textContent = `${formatTemp(lastWeatherData.feelsLikeC)}°${currentUnit}`;

  // Refresh forecast cards (re-render with updated unit)
  populateForecast(lastWeatherData.weatherData);
}

document.addEventListener('DOMContentLoaded', () => {

  // ── Restore recent searches on page load ──────────────────
  renderChips(getRecentSearches());

  // ── Search button click ────────────────────────────────────
  document.getElementById('search-btn').addEventListener('click', () => {
    const city = document.getElementById('search-input').value;
    searchCity(city);
  });

  // ── Enter key in search input ──────────────────────────────
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const city = e.target.value;
      searchCity(city);
    }
  });

  // ── Task 4 Step 18: Debounced search on typing (500 ms) ───
  const debouncedSearch = debounce((city) => {
    if (city.length >= 2) searchCity(city);
  }, 500);

  document.getElementById('search-input').addEventListener('input', (e) => {
    const city = e.target.value;
    if (city.length < 2) {
      hideValidation(); // don't nag mid-typing
      return;
    }
    debouncedSearch(city);
  });

  // ── Retry button ───────────────────────────────────────────
  document.getElementById('retry-btn').addEventListener('click', () => {
    hideError();
    if (lastSearchQuery) searchCity(lastSearchQuery);
  });

  // ── Close error banner ──
  document.getElementById('close-error-btn').addEventListener('click', hideError);

  // ── Bonus: Unit toggle buttons ───────────────────
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = btn.dataset.unit;
      if (unit === currentUnit) return;

      currentUnit = unit;

      // Update active class
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-render temperatures without a new API call
      applyUnitToggle();
    });
  });

  // Here Default load: show Kuala Lumpur weather ────────────────
  searchCity('Kuala Lumpur');
});