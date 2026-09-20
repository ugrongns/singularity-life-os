export interface ParsedWorkout {
  sport_type: 'cycling' | 'running' | 'walking' | 'swimming' | 'strength' | 'hiit' | 'other';
  title: string;
  date: string;
  duration_minutes: number;
  duration_seconds?: number;
  duration_centiseconds?: number; // Toplam salise (1/100 sn, örn: 278435)
  duration_text?: string; // Örn: "46:24", "21:59.40" veya "01:15:30"
  total_duration_minutes?: number;
  distance_km: number;
  distance_meters?: number;
  distance_cm?: number; // Toplam santimetre (örn: 1498000 cm)
  formatted_distance?: string; // Örn: "14,98 km" veya "425 m"
  calories: number;
  avg_speed_kmh?: number;
  max_speed_kmh?: number;
  avg_pace?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  vo2_max?: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  step_count?: number;
  cadence_spm?: number;
  sweat_loss_ml?: number;
  swim_pool_length_m?: number;
  swim_total_lengths?: number;
  swim_stroke_count?: number;
  swim_avg_swolf?: number;
  swim_best_swolf?: number;
  swim_style?: string;
  heart_rate_zones?: {
    zone1?: { label?: string; duration?: string; percent?: number };
    zone2?: { label?: string; duration?: string; percent?: number };
    zone3?: { label?: string; duration?: string; percent?: number };
    zone4?: { label?: string; duration?: string; percent?: number };
    zone5?: { label?: string; duration?: string; percent?: number };
  };
  splits_data?: Array<{
    split_number: number;
    distance_km?: number;
    duration?: string;
    speed_kmh?: number;
    pace?: string;
  }>;
  running_dynamics?: {
    asymmetry?: string;
    ground_contact_time_ms?: number;
    flight_time_ms?: number;
    regularity?: number | string;
    vertical_oscillation_cm?: number;
    stiffness?: string;
  };
  notes?: string;
  device_source?: string;
}

export function parseTimeToSeconds(timeStr: string | number): number {
  if (typeof timeStr === 'number') return Number((timeStr * 60).toFixed(2));
  if (!timeStr) return 0;
  const str = String(timeStr).trim().replace(',', '.');
  const parts = str.split(':').map(p => parseFloat(p));
  if (parts.length === 3) {
    return Number((parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(2));
  } else if (parts.length === 2) {
    return Number((parts[0] * 60 + parts[1]).toFixed(2));
  }
  const val = parseFloat(str);
  return isNaN(val) ? 0 : Number((val * 60).toFixed(2));
}

export function parseTimeToCentiseconds(timeStr: string | number): number {
  const secs = parseTimeToSeconds(timeStr);
  return Math.round(secs * 100);
}

export function formatSecondsToTime(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds)) return '00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const remainingSecs = totalSeconds % 3600;
  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  
  const hasCentis = Math.round(secs * 100) % 100 !== 0;
  const formattedSecs = hasCentis
    ? secs.toFixed(2).padStart(5, '0')
    : String(Math.floor(secs)).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${formattedSecs}`;
  }
  return `${String(mins).padStart(2, '0')}:${formattedSecs}`;
}

/**
 * Antrenman Ekran Görüntüsü / Rapor Ayrıştırma Motoru (AI Vision Pipeline)
 * Samsung Health, Strava, Apple Health, Garmin vb. ekran görüntülerini analiz eder.
 */
export async function parseWorkoutImage(
  base64Input: string | string[],
  mimeInput: string | string[] = []
): Promise<ParsedWorkout> {
  const base64Images = Array.isArray(base64Input) ? base64Input : [base64Input];
  const mimeTypes = Array.isArray(mimeInput) ? mimeInput : [mimeInput];
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const promptText = `Sen uzman bir spor fizyoloğu, antrenman telemetrisi analisti ve OCR uzmanısın.
Kullanıcının paylaştığı akıllı saat veya sağlık uygulaması (Samsung Health, Strava, Apple Watch, Garmin vb.) antrenman ekran görüntüsünü analiz et.

GÖREVİN:
Görseldeki tüm antrenman metriklerini yüksek hassasiyetle oku ve aşağıdaki JSON şemasına birebir uygun çıktı üret.

Tespit Edilecek Alanlar:
1. sport_type: 'cycling' (Bisiklet), 'running' (Koşu), 'walking' (Yürüyüş), 'swimming' (Yüzme), 'strength' (Kuvvet/Ağırlık), 'hiit', 'other'.
2. title: Şık ve anlaşılır bir başlık (örn: "Göksu Parkı Bisiklet", "Sabah Koşusu", "Havuzda Yüzme (25m)").
3. date: YYYY-MM-DD formatında tarih (görselde varsa oku, yoksa bugünün tarihini ver).
4. duration_text: Antrenman süresinin tam dakika, saniye ve varsa salise metni (örn: "46:24", "21:59.40", "01:15:30" veya "38:04").
5. distance_text: Mesafenin birimiyle orijinal metni (örn: "14,98 km" veya "425 m" veya "5,16 km").
6. distance_km: Kat edilen mesafe (km cinsinden sayı, örn: 14.98 veya 0.425).
7. calories: Yakılan kalori (kcal cinsinden tam sayı, örn: 498 veya 291).
8. avg_speed_kmh: Ortalama hız (km/sa, örn: 19.3 veya 15.2).
9. max_speed_kmh: Maksimum hız (km/sa, örn: 46.6 veya 42.3).
10. avg_pace: Ortalama adım hızı / tempo (örn: "03'05\" /km" veya "05'13\" /100 m").
11. avg_heart_rate: Ortalama kalp atış hızı (bpm, örn: 128 veya 112).
12. max_heart_rate: Maksimum kalp atış hızı (bpm, örn: 158 veya 147).
13. vo2_max: Maksimum VO2 değeri (sayı, örn: 39.3 veya 39.6).
14. elevation_gain_m: Tırmanış / Yükselme (metre, örn: 174 veya 340).
15. elevation_loss_m: İniş (metre).
16. step_count: Toplam adım sayısı (yürüyüş/koşu için, örn: 6476).
17. cadence_spm: Ortalama tempo / kadans (adım/dk veya rpm, örn: 110 veya 128).
18. sweat_loss_ml: Tahmini ter kaybı (ml cinsinden, örn: 244 veya 237).
19. swim_pool_length_m: Havuz uzunluğu (metre, örn: 25).
20. swim_total_lengths: Toplam havuz uzunluğu / tur sayısı (örn: 17).
21. swim_stroke_count: Toplam kulaç sayısı (örn: 464).
22. swim_avg_swolf: Ortalama SWOLF skoru (örn: 105).
23. swim_best_swolf: En iyi SWOLF skoru (örn: 22).
24. swim_style: Yüzme stili (örn: "Serbest stil").
25. heart_rate_zones: Kalp atış hızı bölgeleri {
      zone1: { label: "Düşük yoğunluk", duration: "07:55", percent: 22.4 },
      zone2: { label: "Kilo kontrolü", duration: "20:35", percent: 58.1 },
      zone3: { label: "Aerobik", duration: "05:04", percent: 14.4 },
      zone4: { label: "Anaerobik", duration: "00:25", percent: 1.2 },
      zone5: { label: "Maksimum", duration: "00:00", percent: 0.0 }
    }
26. splits_data: Varsa bölme/tur tablosu dizi olarak.
27. running_dynamics: Koşu dinamikleri {
      asymmetry: "Harika %92",
      ground_contact_time_ms: 176,
      flight_time_ms: 191,
      regularity: 0.95,
      vertical_oscillation_cm: 9.0,
      stiffness: "Gelişmiş"
    }
28. device_source: Cihaz bilgisi (örn: "Galaxy Watch6").

SADECE geçerli bir JSON çıktısı üret, markdown veya açıklama yazma.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  ...base64Images.map((base64Image, index) => ({
                    inlineData: {
                      mimeType: mimeTypes[index] || 'image/jpeg',
                      data: base64Image.replace(/^data:image\/\w+;base64,/, '')
                    }
                  }))
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          })
        }
      );

      if (response.ok) {
        const jsonResult = await response.json();
        const textOutput = jsonResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textOutput) {
          const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          const durationText = parsed.duration_text || (parsed.duration_minutes ? formatSecondsToTime(Number(parsed.duration_minutes) * 60) : '30:00');
          const durationSeconds = parsed.duration_seconds !== undefined ? Number(parsed.duration_seconds) : parseTimeToSeconds(durationText);
          const durationCentiseconds = parsed.duration_centiseconds !== undefined ? Math.round(Number(parsed.duration_centiseconds)) : parseTimeToCentiseconds(durationSeconds);
          const durationMinutes = Math.round(durationSeconds / 60) || 30;

          let distanceKm = Number(parsed.distance_km) || 0;
          let distanceMeters = parsed.distance_meters !== undefined ? Number(parsed.distance_meters) : undefined;
          let distanceCm = parsed.distance_cm !== undefined ? Number(parsed.distance_cm) : undefined;
          let formattedDistance = parsed.distance_text || undefined;

          if (distanceMeters === undefined && distanceKm > 0) {
            distanceMeters = Number((distanceKm * 1000).toFixed(2));
          }
          if (distanceCm === undefined && distanceMeters !== undefined) {
            distanceCm = Math.round(distanceMeters * 100);
          }
          if (!formattedDistance && distanceKm > 0) {
            formattedDistance = (parsed.sport_type === 'swimming' || distanceKm < 1)
              ? `${distanceMeters} m`
              : `${distanceKm.toFixed(2).replace('.', ',')} km`;
          }

          return {
            sport_type: parsed.sport_type || 'other',
            title: parsed.title || 'Antrenman',
            date: parsed.date || new Date().toISOString().split('T')[0],
            duration_minutes: durationMinutes,
            duration_seconds: durationSeconds,
            duration_centiseconds: durationCentiseconds,
            duration_text: durationText,
            total_duration_minutes: Math.round(Number(parsed.total_duration_minutes) || durationMinutes),
            distance_km: distanceKm,
            distance_meters: distanceMeters,
            distance_cm: distanceCm,
            formatted_distance: formattedDistance,
            calories: Math.round(Number(parsed.calories)) || 0,
            avg_speed_kmh: parsed.avg_speed_kmh ? Number(parsed.avg_speed_kmh) : undefined,
            max_speed_kmh: parsed.max_speed_kmh ? Number(parsed.max_speed_kmh) : undefined,
            avg_pace: parsed.avg_pace || undefined,
            avg_heart_rate: parsed.avg_heart_rate ? Math.round(Number(parsed.avg_heart_rate)) : undefined,
            max_heart_rate: parsed.max_heart_rate ? Math.round(Number(parsed.max_heart_rate)) : undefined,
            vo2_max: parsed.vo2_max ? Number(parsed.vo2_max) : undefined,
            elevation_gain_m: parsed.elevation_gain_m ? Number(parsed.elevation_gain_m) : undefined,
            elevation_loss_m: parsed.elevation_loss_m ? Number(parsed.elevation_loss_m) : undefined,
            step_count: parsed.step_count ? Math.round(Number(parsed.step_count)) : undefined,
            cadence_spm: parsed.cadence_spm ? Math.round(Number(parsed.cadence_spm)) : undefined,
            sweat_loss_ml: parsed.sweat_loss_ml ? Math.round(Number(parsed.sweat_loss_ml)) : undefined,
            swim_pool_length_m: parsed.swim_pool_length_m ? Math.round(Number(parsed.swim_pool_length_m)) : undefined,
            swim_total_lengths: parsed.swim_total_lengths ? Math.round(Number(parsed.swim_total_lengths)) : undefined,
            swim_stroke_count: parsed.swim_stroke_count ? Math.round(Number(parsed.swim_stroke_count)) : undefined,
            swim_avg_swolf: parsed.swim_avg_swolf ? Math.round(Number(parsed.swim_avg_swolf)) : undefined,
            swim_best_swolf: parsed.swim_best_swolf ? Math.round(Number(parsed.swim_best_swolf)) : undefined,
            swim_style: parsed.swim_style || undefined,
            heart_rate_zones: parsed.heart_rate_zones || undefined,
            splits_data: parsed.splits_data || undefined,
            running_dynamics: parsed.running_dynamics || undefined,
            notes: parsed.notes || undefined,
            device_source: parsed.device_source || 'Akıllı Saat'
          };
        }
      }
    } catch (err) {
      console.error('[Workout OCR] Error calling Gemini Vision:', err);
    }
  }

  // Basit varsayılan taslak (Fallback)
  return {
    sport_type: 'other',
    title: 'Yeni Antrenman',
    date: new Date().toISOString().split('T')[0],
    duration_minutes: 30,
    distance_km: 0,
    calories: 0,
    device_source: 'Manuel Giriş'
  };
}
