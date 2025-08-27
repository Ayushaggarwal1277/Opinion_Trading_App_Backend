import asyncHandler from "../utils/asyncHandler.js";
import fetch from "node-fetch";

// Get current weather data for Delhi
const getCurrentWeather = asyncHandler(async (req, res) => {
    try {
        // Fetch current weather data from Open-Meteo API for Delhi
        const response = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=28.625&longitude=77.25&current_weather=true&timezone=Asia%2FKolkata'
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch weather data');
        }
        
        const data = await response.json();
        const currentWeather = data.current_weather;
        
        return res.status(200).json({
            success: true,
            data: {
                temperature: currentWeather.temperature,
                weatherCode: currentWeather.weathercode,
                windSpeed: currentWeather.windspeed,
                windDirection: currentWeather.winddirection,
                time: currentWeather.time,
                location: 'Delhi, India',
                coordinates: {
                    latitude: 28.625,
                    longitude: 77.25
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch current weather data',
            error: error.message
        });
    }
});

export { getCurrentWeather };
