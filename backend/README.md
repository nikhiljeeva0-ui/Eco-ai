# EcoSphere Neural — Backend API

AI-powered energy prediction backend built with FastAPI.

## Quick Start

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```

## API Endpoints

| Method | Endpoint           | Description                          |
|--------|--------------------|--------------------------------------|
| GET    | `/`                | Health check                         |
| POST   | `/analyze-energy`  | Upload CSV → get energy analysis     |

## Interactive Docs

Once running, open: **http://127.0.0.1:8000/docs**

## CSV Format

The uploaded CSV must contain an `Energy_kWh` column:

```csv
Date,Energy_kWh
Jan,1200
Feb,1300
Mar,1250
```

## Response Example

```json
{
  "total_energy": 17100.0,
  "total_carbon": 14022.0,
  "prediction_next_month": 1677.27,
  "model_accuracy": 0.4902
}
```
