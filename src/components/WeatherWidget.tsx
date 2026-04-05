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

const WEATHER_EMOJI: Record<string, string> = {
  '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️',
  '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '🌨️', '50': '🌫️',
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
    setMounted(true);
    if (!apiKey || apiKey === 'your_openweathermap_api_key') { setLoading(false); return; }

    const fetchWeather = (url: string) => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (data.main) {
            setWeather({
              temp: Math.round(data.main.temp),
              feels_like: Math.round(data.main.feels_like),
              description: data.weather[0].description,
              icon: data.weather[0].icon,
              humidity: data.main.humidity,
              wind_speed: Math.round(data.wind.speed),
              city: data.name,
            });
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    // Try geolocation first, fall back to default city
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchWeather(
            `https://api.openweathermap.org/data/2.5/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&appid=${apiKey}&units=imperial`
          );
        },
        () => {
          // Permission denied or error — fall back to configured city
          const city = process.env.NEXT_PUBLIC_WEATHER_CITY || 'Bedford,MA,US';
          fetchWeather(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=imperial`
          );
        },
        { timeout: 5000 }
      );
    } else {
      const city = process.env.NEXT_PUBLIC_WEATHER_CITY || 'Bedford,MA,US';
      fetchWeather(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=imperial`
      );
    }
  }, []);

  if (!mounted || loading) return <div className="rounded-2xl bg-surface-2 border border-border p-4"><div className="h-14 bg-surface-3 rounded-lg animate-pulse" /></div>;

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
    </div>
  );
}
