import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { WEATHER, WEATHER_KINDS } from "../../content/weather.ts";
import { startTestEngine, stopTestEngine } from "../testing/engine-fixtures.ts";
import { createWeather, resetWorld, showWorld } from "../testing/world-fixtures.ts";
import { WeatherSection } from "./weather-section.tsx";

describe("weather section", () => {
  afterEach(() => {
    resetWorld();
  });

  it("stays empty until the first frame arrives", async () => {
    const screen = await render(<WeatherSection />);

    expect(screen.container).toBeEmptyDOMElement();
  });

  it("lets the seasons choose the weather when it is automatic", async () => {
    showWorld({ weather: createWeather({ isAutomatic: true, kind: "rain", name: "Rain" }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByRole("combobox", { name: "Weather" })).toHaveTextContent("Changes by itself");
  });

  it("shows the weather that was chosen by hand", async () => {
    showWorld({ weather: createWeather({ isAutomatic: false, kind: "storm", name: "Thunderstorm" }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByRole("combobox", { name: "Weather" })).toHaveTextContent("Thunderstorm");
  });

  it("offers every kind of weather", async () => {
    showWorld();

    const screen = await render(<WeatherSection />);

    await screen.getByRole("combobox", { name: "Weather" }).click();

    await expect.element(screen.getByRole("option", { name: "Changes by itself" })).toBeVisible();

    await Promise.all(
      WEATHER_KINDS.map((kind) =>
        expect.element(screen.getByRole("option", { name: WEATHER[kind].name })).toBeInTheDocument()
      )
    );
  });

  it("names the direction the wind blows from", async () => {
    showWorld({ weather: createWeather({ windDirection: 225 }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByRole("slider", { name: "Wind from" })).toHaveValue("225");
    await expect.element(screen.getByText("SW · 225°")).toBeVisible();
  });

  it("rounds the wind direction to the nearest compass point", async () => {
    showWorld({ weather: createWeather({ windDirection: 350 }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByText("N · 350°")).toBeVisible();
  });

  it("shows the base wind speed and the temperature change", async () => {
    showWorld({ weather: createWeather({ userTemperatureOffset: -5, windBaseSpeed: 20, windSpeed: 26 }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByRole("slider", { name: "Wind speed" })).toHaveValue("20");
    await expect.element(screen.getByText("20 km/h")).toBeVisible();
    await expect.element(screen.getByRole("slider", { name: "Temperature" })).toHaveValue("-5");
    await expect.element(screen.getByText("-5 °C")).toBeVisible();
  });

  it("marks a warmer island with a plus sign", async () => {
    showWorld({ weather: createWeather({ userTemperatureOffset: 3 }) });

    const screen = await render(<WeatherSection />);

    await expect.element(screen.getByText("+3 °C")).toBeVisible();
  });
});

describe("weather section in a running game", () => {
  afterEach(() => {
    stopTestEngine();
    resetWorld();
  });

  it("keeps a new wind direction when the speed changes right after", async () => {
    const { send } = await startTestEngine();

    showWorld({ weather: createWeather({ windBaseSpeed: 20, windDirection: 90 }) });

    const screen = await render(<WeatherSection />);

    screen.getByRole("slider", { name: "Wind from" }).element().focus();
    await userEvent.keyboard("{ArrowRight}");
    screen.getByRole("slider", { name: "Wind speed" }).element().focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(send).toHaveBeenLastCalledWith({ direction: 91, speed: 21, type: "setWind" });
  });
});
