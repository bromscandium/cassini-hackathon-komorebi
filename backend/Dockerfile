FROM python:3.10-slim

# Set working directory inside container
WORKDIR /app

# Copy the requirements file from the repo root's backend folder
COPY backend/requirements.txt /app/requirements.txt

# Install Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Now copy over the rest of the backend/
COPY backend /app

# Expose and run
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
