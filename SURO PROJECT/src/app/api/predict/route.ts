import { NextRequest, NextResponse } from "next/server";
import { cameraLocations } from "@/lib/locations";
import { getWeatherForTime, getCurrentTimeInfo } from "@/lib/weather";
import { 
  PredictionResult, 
  BatchPredictionResponse,
  CONGESTION_LABELS,
  CongestionLevel 
} from "@/lib/types";

// Mock prediction function to replace ONNX
function predict(
  inputData: number[]
): { congestion: CongestionLevel; probability: number } {
  // Generate a random congestion level (0, 1, or 2)
  // We can use the input data to make it deterministic if needed, but random is fine for now
  // or maybe use the hour to make it slightly realistic
  
  const hour = inputData[2];
  const random = Math.random();
  
  let congestion: CongestionLevel = 0;
  
  // Simple heuristic: more traffic during rush hours (7-9, 16-18)
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
     if (random > 0.3) congestion = 2; // High
     else if (random > 0.1) congestion = 1; // Moderate
     else congestion = 0; // Low
  } else {
     if (random > 0.8) congestion = 2;
     else if (random > 0.5) congestion = 1;
     else congestion = 0;
  }

  const probability = 0.5 + (Math.random() * 0.4); // Random probability between 0.5 and 0.9
  
  return { congestion, probability };
}

export async function GET(request: NextRequest) {
  try {
    // Get optional parameters
    const searchParams = request.nextUrl.searchParams;
    const customHour = searchParams.get("hour");
    const customDay = searchParams.get("day");
    
    // Get current time or use custom
    const timeInfo = getCurrentTimeInfo();
    const hour = customHour ? parseInt(customHour) : timeInfo.hour;
    const day = customDay ? parseInt(customDay) : timeInfo.day;
    
    // Get weather for center of camera network
    const centerLat = cameraLocations.reduce((sum, loc) => sum + loc.latitude, 0) / cameraLocations.length;
    const centerLng = cameraLocations.reduce((sum, loc) => sum + loc.longitude, 0) / cameraLocations.length;
    const weather = await getWeatherForTime(centerLat, centerLng, hour, day);
    
    // Run predictions for all locations
    const predictions: PredictionResult[] = [];
    
    for (const location of cameraLocations) {
      // Input order (8 features): [lat, lon, hour, day, temp, precip, rain, wind]
      const inputData = [
        location.latitude,
        location.longitude,
        hour,
        day,
        weather.temperature_2m,
        weather.precipitation,
        weather.rain,
        weather.wind_speed_10m,
      ];
      
      const { congestion, probability } = predict(inputData);
      
      predictions.push({
        location: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        congestion,
        congestionLabel: CONGESTION_LABELS[congestion] as "Low" | "Moderate" | "High",
        probability,
      });
    }
    
    const response: BatchPredictionResponse = {
      predictions,
      weather,
      timestamp: new Date().toISOString(),
      hour,
      day,
    };
    
    return NextResponse.json(response);
    
  } catch (err: any) {
    console.error("Prediction error:", err);
    return NextResponse.json(
      { 
        error: "Failed to generate predictions", 
        details: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
