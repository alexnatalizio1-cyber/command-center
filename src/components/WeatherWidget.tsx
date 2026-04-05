'use client';

import { useState, useEffect } from 'react';
import { Wind, Droplets, MapPin } from 'lucide-react';

interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  humidity: number;
  wind_speed: number;
  city: string;
}

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  icon: string;
  description: string;
}

const WEATHER_EMOJI: Record<string, string> = {
  '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
  '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '🌨️', '50': '🌫️',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
    setMounted(true);
    if (!apiKey || apiKey === 'your_openweathermap_api_key') { setLoading(false); return; }

    const fetchAll = (lat: number, lon: number) => {
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;

      Promise.all([
        fetch(currentUrl).then(r => r.json()),
        fetch(forecastUrl).then(r => r.json()),
      ]).then(([current, fc]) => {
        if (current.main) {
          setWeather({
            temp: Math.round(current.main.temp),
            feels_like: Math.round(current.main.feels_like),
            description: current.weather[0].description,
            icon: current.weather[0].icon,
            humidity: current.main.humidity,
            wind_speed: Math.round(current.wind.speed),
            city: current.name,
          });
        }
        if (fc.list) {
          // Group by day, pick midday reading, get high/low
          const days = new Map<string, { temps: number[]; entry: { weather: { icon: string; description: string }[] } }>();
          for (const entry of fc.list) {
            const date = entry.dt_txt.split(' ')[0];
            const today = new Date().toISOString().split('T')[0];
            if (date === today) continue; // skip today
            if (!days.has(date)) {
              days.set(date, { temps: [], entry });
            }
            const d = days.get(date)!;
            d.temps.push(entry.main.temp);
            // Prefer midday reading for icon
            const hour = parseInt(entry.dt_txt.split(' ')[1].split(':')[0]);
            if (hour >= 11 && hour <= 14) {
              d.entry = entry;
            }
          }
          const forecastDays: ForecastDay[] = [];
          days.forEach((val, dateStr) => {
            if (forecastDays.length >= 6) return;
            const date = new Date(dateStr + 'T12:00:00');
            forecastDays.push({
              day: DAY_NAMES[date.getDay()],
              high: Math.round(Math.max(...val.temps)),
              low: Math.round(Math.min(...val.temps)),
              icon: val.entry.weather[0].icon,
              description: val.entry.weather[0].description,
            });
          });
          setForecast(forecastDays);
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    };

    const fetchByCity = (city: string) => {
      // Get coords from city name first
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=imperial`)
        .then(r => r.json())
        .then(data => {
          if (data.coord) {
            fetchAll(data.coord.lat, data.coord.lon);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchAll(pos.coords.latitude, pos.coords.longitude),
        () => fetchByCity(process.env.NEXT_PUBLIC_WEATHER_CITY || 'Bedford,MA,US'),
        { timeout: 5000 }
      );
    } else {
      fetchByCity(process.env.NEXT_PUBLIC_WEATHER_CITY || 'Bedford,MA,US');
    }
  }, []);

  if (!mounted || loading) {
    return (
      <div className="rounded-2xl bg-surface-2 border border-border p-4">
        <div className="h-14 bg-surface-3 rounded-lg animate-pulse" />
        <div className="mt-3 grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-3 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="rounded-2xl bg-surface-2 border border-border p-4">
        <div className="flex items-center gap-2.5 text-gray-400 dark:text-zinc-500">
          <span className="text-xl">🌤️</span>
          <div>
            <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">Weather</p>
            <p className="text-[11px]">Add NEXT_PUBLIC_WEATHER_API_KEY to .env</p>
          </div>
        </div>
      </div>
    );
  }

  const emoji = WEATHER_EMOJI[weather.icon.slice(0, 2)] || '🌤️';

  return (
    <div className="rounded-2xl bg-surface-1 border border-border p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Current weather */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium flex items-center gap-1">
            <MapPin className="w-3 h-3" />{weather.city}
          </p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{weather.temp}°</span>
            <span className="text-[13px] text-gray-500 dark:text-zinc-400 capitalize">{weather.description}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-zinc-500">
            <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{weather.humidity}%</span>
            <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{weather.wind_speed} mph</span>
            <span>Feels {weather.feels_like}°</span>
          </div>
        </div>
        <span className="text-3xl">{emoji}</span>
      </div>

      {/* Weekly forecast */}
      {forecast.length > 0 && (
        <>
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700/50">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${forecast.length}, 1fr)` }}>
              {forecast.map((day) => {
                const dayEmoji = WEATHER_EMOJI[day.icon.slice(0, 2)] || '🌤️';
                return (
                  <div key={day.day} className="flex flex-col items-center gap-0.5 py-1">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">{day.day}</span>
                    <span className="text-base">{dayEmoji}</span>
                    <span className="text-[12px] font-semibold text-gray-900 dark:text-white tabular-nums">{day.high}°</span>
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 tabular-nums">{day.low}°</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
