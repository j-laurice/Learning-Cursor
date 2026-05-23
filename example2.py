import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def ssl_context() -> ssl.SSLContext:
    """Build a context that can verify HTTPS on macOS python.org installs."""
    ca_sources: list[str] = []

    try:
        import certifi

        ca_sources.append(certifi.where())
    except ImportError:
        pass

    defaults = ssl.get_default_verify_paths()
    if defaults.openssl_cafile:
        ca_sources.append(defaults.openssl_cafile)
    ca_sources.extend(["/etc/ssl/cert.pem", "/private/etc/ssl/cert.pem"])

    for ca_file in ca_sources:
        if ca_file and os.path.isfile(ca_file):
            return ssl.create_default_context(cafile=ca_file)

    return ssl.create_default_context()


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url)
    with urllib.request.urlopen(request, timeout=15, context=ssl_context()) as response:
        return json.load(response)


def ssl_help_message() -> str:
    python_root = os.path.dirname(os.path.dirname(sys.executable))
    cert_installer = os.path.join(python_root, "Install Certificates.command")
    lines = [
        "SSL certificate verification failed. This is common with Python from python.org on Mac.",
        "",
        "Fix (pick one):",
        f"  1. Double-click: {cert_installer}",
        "     (then run this script again)",
        "  2. Or run: pip3 install certifi",
        "  3. Or use Homebrew Python: brew install python",
    ]
    if not os.path.isfile(cert_installer):
        lines[3] = "  1. Re-run the Python installer, or run: pip3 install certifi"
    return "\n".join(lines)


def lookup_city(name: str) -> dict:
    params = urllib.parse.urlencode({"name": name, "count": 1, "language": "en", "format": "json"})
    data = fetch_json(f"{GEOCODING_URL}?{params}")
    results = data.get("results") or []
    if not results:
        raise ValueError(f'No city found for "{name}". Try another spelling.')
    return results[0]


def fetch_weather(latitude: float, longitude: float) -> dict:
    params = urllib.parse.urlencode(
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation,weather_code",
            "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "forecast_days": 1,
        }
    )
    return fetch_json(f"{FORECAST_URL}?{params}")


def outfit_advice(temp_c: float, wind_kmh: float, humidity: float, precipitation_mm: float) -> list[str]:
    tips: list[str] = []

    if temp_c >= 28:
        tips.extend(["Light t-shirt or tank top", "Shorts or breathable skirt", "Sandals or sneakers", "Sunscreen and a hat"])
    elif temp_c >= 20:
        tips.extend(["T-shirt or light blouse", "Light pants, jeans, or shorts", "Comfortable sneakers"])
    elif temp_c >= 15:
        tips.extend(["Long sleeves or a light sweater", "Jeans or light trousers", "Optional light jacket"])
    elif temp_c >= 10:
        tips.extend(["Sweater or fleece", "Jeans or warm trousers", "Light to medium jacket"])
    elif temp_c >= 5:
        tips.extend(["Warm sweater", "Insulated jacket or coat", "Closed shoes"])
    elif temp_c >= 0:
        tips.extend(["Thermal layer", "Winter coat", "Warm hat and gloves"])
    else:
        tips.extend(["Heavy winter coat", "Thermal layers", "Hat, gloves, and scarf", "Warm boots"])

    if wind_kmh >= 40:
        tips.append("Strong wind — add a windbreaker and expect wind chill")
    elif wind_kmh >= 25 and temp_c < 18:
        tips.append("Windbreaker or shell layer")

    if humidity >= 80 and temp_c >= 18:
        tips.append("High humidity — light, breathable fabrics will feel best")
    elif humidity >= 75 and temp_c < 10:
        tips.append("Damp air makes it feel colder — add an extra layer")

    if precipitation_mm > 0.2:
        tips.extend(["Waterproof jacket or raincoat", "Umbrella", "Water-resistant shoes"])
    elif precipitation_mm > 0:
        tips.append("A light rain layer might be useful")

    return tips


def main() -> None:
    city_input = input("Which city? ").strip()
    if not city_input:
        print("Please enter a city name.")
        return

    try:
        place = lookup_city(city_input)
        weather = fetch_weather(place["latitude"], place["longitude"])
    except ValueError as err:
        print(err)
        return
    except urllib.error.URLError as err:
        reason = getattr(err, "reason", None)
        if isinstance(reason, ssl.SSLCertVerificationError) or "CERTIFICATE_VERIFY_FAILED" in str(err):
            print(ssl_help_message())
        else:
            print(f"Could not reach the weather service: {err}")
        return

    current = weather["current"]
    temp = current["temperature_2m"]
    wind = current["wind_speed_10m"]
    humidity = current["relative_humidity_2m"]
    rain = current.get("precipitation") or 0

    location = f'{place["name"]}, {place.get("country_code", "")}'.strip(", ")
    print(f"\nWeather in {location}")
    print(f"  Temperature: {temp}°C")
    print(f"  Wind:        {wind} km/h")
    print(f"  Humidity:    {humidity}%")
    if rain:
        print(f"  Precipitation: {rain} mm")

    print("\nWhat to wear:")
    for tip in outfit_advice(temp, wind, humidity, rain):
        print(f"  • {tip}")


if __name__ == "__main__":
    main()
