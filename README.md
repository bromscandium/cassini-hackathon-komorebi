# Cassini Hackathon: Komorebi Team

🌍 **Interactive Disaster Simulation Using Copernicus Data** 🌍

---

## 📖 Project Overview

Komorebi is an interactive, React-based web application with a Python backend, built for the Cassini Hackathon. It leverages real-time and historical disaster data from the **Copernicus Emergency Management Service** to simulate disaster response scenarios. The application integrates OpenAI's API to help users visualize, strategize, and manage resources effectively during disaster events.

---

## ✨ Features

* **Interactive Map** powered by **MapLibre**.
* Real-time disaster scenarios and historical data visualization.
* **Action Center** to manage disaster response actions.
* Comprehensive resource dashboard:

  * Medical resources
  * Logistics
  * Emergency personnel
* AI-driven response analysis using OpenAI API.
* Scenario-driven game mechanics for enhanced user engagement and learning.

---

## 🔑 Environment Variables

Create a `.env` file in the root directory and provide your API keys:

```env
CDS_ADS_API_KEY=your_copernicus_api_key
TAVILI_API_KEY=tvly-your_tavili_api_key
OPENAI_API_KEY=your_openai_api_key
```

---

## 🛠 Installation

Clone the repository:

```bash
git clone https://github.com/bromscandium/cassini-hackathon-komorebi.git
cd cassini-hackathon-komorebi
```

Build and run the application with Docker:

```bash
docker-compose up --build
```

---

## 🚀 Running the Application

The frontend will be available at:

```
http://localhost:3000
```

The backend will be available at:

```
http://localhost:8000
```
